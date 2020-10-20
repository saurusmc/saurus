import {
  WebSocket,
  isWebSocketPingEvent,
  isWebSocketCloseEvent,
  isWebSocketPongEvent,
  WebSocketPingEvent,
  WebSocketPongEvent
} from "std/ws/mod.ts";

import { EventEmitter } from "mutevents";
import { Timeout } from "timeout"
import { Abort } from "abortable";

import { ChannelCloseError, WSChannel } from "./channel.ts";

import { CloseError, WSMessage } from "./message.ts";

export interface Message<T = unknown> {
  channel: WSChannel,
  data: T
}

export interface WSConnectionEvents {
  ping: WebSocketPingEvent
  pong: WebSocketPongEvent
  message: WSMessage
  close: CloseError
}

export class ConnectionCloseError extends CloseError { }

export class WSConnection extends EventEmitter<WSConnectionEvents> {
  readonly channels = new EventEmitter<{
    [path: string]: Message<unknown>
  }>()

  constructor(
    readonly socket: WebSocket
  ) {
    super();

    const off = this.on(["message"],
      this.onmessage.bind(this))

    this.once(["close"], off)

    this._listen()
  }

  get closed() {
    return this.socket.isClosed;
  }

  private async _listen() {
    try {
      for await (const e of this.socket) {
        if (isWebSocketPingEvent(e))
          await this.emit("ping", e)

        if (isWebSocketPongEvent(e))
          await this.emit("pong", e)

        if (isWebSocketCloseEvent(e)) {
          const error = new ConnectionCloseError(e.reason)
          await this.emit("close", error)
          return;
        }

        if (typeof e === "string")
          this.handlemessage(e)
      }

      const error = new ConnectionCloseError()
      await this.emit("close", error)
    } catch (e) {
      if (e instanceof ConnectionCloseError)
        return
      else if (e instanceof ChannelCloseError)
        await this.close(e.reason)
      else if (e instanceof Error)
        await this.close(e.message)
    }
  }

  private async handlemessage(e: string) {
    try {
      const msg = JSON.parse(e) as WSMessage
      await this.emit("message", msg)
    } catch (e) {
      if (e instanceof ConnectionCloseError)
        return
      else if (e instanceof ChannelCloseError)
        await this.close(e.reason)
      else if (e instanceof Error)
        await this.close(e.message)
    }
  }

  private async onmessage(msg: WSMessage) {
    if (msg.type !== "open") return
    const channel = new WSChannel(this, msg.uuid)

    try {
      await channel.emit("open", msg.path)
      await channel.emit("message", msg.data)
      const message = { channel, data: msg.data }
      await this.channels.emit(msg.path, message)
    } catch (e) {
      if (e instanceof CloseError)
        return
      else if (e instanceof Error)
        await channel.throw(e.message)
    }
  }

  async send(msg: WSMessage) {
    const text = JSON.stringify(msg);
    await this.socket.send(text);
  }

  async close(reason?: string) {
    await this.socket.close(1000, reason ?? "Unknown");
    await this.emit("close", new ConnectionCloseError(reason))
  }

  /**
   * Wait for an open message on a path
   * @param path Path to listen on
   * @param delay Timeout delay
   * @throws CloseError | TimeoutError
   */
  async waitopen(path: string, delay = 0) {
    const message = this.channels.wait([path])
    const close = this.error(["close"])

    if (delay > 0) {
      return await Timeout.race([message, close], 1000)
    } else {
      return await Abort.race([message, close])
    }
  }

  /**
   * Listen on a path
   * @param path Path to listen on
   * @yields Message
   * @throws CloseError
   */
  async * listen(path: string) {
    while (true) yield this.waitopen(path)
  }

  /**
   * Open a channel
   * @param path Path
   * @param data Data to send
   */
  async open(path: string, data?: unknown) {
    const channel = new WSChannel(this)
    await channel.open(path, data)
    return channel
  }

  /**
   * Open a channel; wait for a message; wait for close
   * @param path Path
   * @param request Data to send
   * @param delay Timeout delay
   * @returns Data received
   */
  async request<T>(path: string, request?: unknown, delay = 1000) {
    const channel = await this.open(path, request)
    const result = await channel.read<T>(delay)
    await channel.waitclose;
    return result;
  }
}