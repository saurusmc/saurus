import {
  WebSocket,
  isWebSocketPingEvent,
  isWebSocketCloseEvent,
  isWebSocketPongEvent,
  WebSocketPingEvent,
  WebSocketPongEvent
} from "https://deno.land/std/ws/mod.ts";

import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts";
import { Timeout } from "https://deno.land/x/timeout/mod.ts"
import { Abort } from "https://deno.land/x/abortable/mod.ts";

import { WSChannel } from "./channel.ts";

import type { WSMessage } from "./message.ts";

export class Close {
  constructor(readonly reason?: string) { }
}

export interface Message<T = unknown> {
  channel: WSChannel,
  data: T
}

export interface WSConnectionEvents {
  ping: WebSocketPingEvent
  pong: WebSocketPongEvent
  message: WSMessage
  close: Close
}

export class WSConnection extends EventEmitter<WSConnectionEvents> {
  readonly channels = new EventEmitter<{
    [path: string]: Message
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

  async *[Symbol.asyncIterator]() {
    while (true) {
      try {
        yield await this.read()
      } catch (e) {
        if (e instanceof Close) return;
        throw e
      }
    }
  }

  get closed() {
    return this.socket.isClosed;
  }

  private async _listen() {
    try {
      for await (const e of this.socket) {
        if (isWebSocketPingEvent(e))
          this.emit("ping", e)

        if (isWebSocketPongEvent(e))
          this.emit("pong", e)

        if (isWebSocketCloseEvent(e)) {
          const close = new Close(e.reason)
          await this.emit("close", close)
          return;
        }

        if (typeof e === "string") {
          const msg = JSON.parse(e) as WSMessage
          this.emit("message", msg)
        }
      }

      await this.emit("close", new Close())
    } catch (e) {
      if (e instanceof Error)
        await this.close(e.message)
      else console.error(e)
    }
  }

  protected async onmessage(msg: WSMessage) {
    if (msg.type === "open") {
      const { uuid, path, data } = msg;
      const channel = new WSChannel(this, uuid)
      await this.channels.emit(path, { channel, data })
    }
  }

  async send(msg: WSMessage) {
    if (this.closed)
      throw new Error("Closed")

    const text = JSON.stringify(msg);
    await this.socket.send(text);
  }

  async close(reason = "Unknown") {
    if (this.closed)
      throw new Error("Closed")

    await this.socket.close(1000, reason);
    await this.emit("close", new Close(reason))
  }

  async read(timeout = false) {
    const message = this.wait(["message"])
    const close = this.error(["close"])

    if (timeout) {
      return await Timeout.race([message, close], 1000)
    } else {
      return await Abort.race([message, close])
    }
  }

  async* listen<T = unknown>(path: string) {
    while (true) {
      try {
        const message = this.channels.wait([path])
        const close = this.error(["close"])
        const data = await Abort.race([message, close])
        yield data as Message<T>
      } catch (e) {
        if (e instanceof Close) return;
        throw e
      }
    }
  }

  /**
   * Open a channel
   * @param path Path
   * @param data Data
   */
  async open(path: string, data?: unknown) {
    const channel = new WSChannel(this)
    await channel.open(path, data)
    return channel
  }

  /**
   * Open a channel and read it
   * @param path Path
   * @param req Data
   */
  async request<T>(path: string, req?: unknown, delay = 1000) {
    const channel = await this.open(path, req)
    const res = await channel.read<T>(delay)
    return { channel, data: res } as Message<T>;
  }
}