"use strict";

import {
  WebSocket,
  isWebSocketPingEvent,
  isWebSocketCloseEvent,
  isWebSocketPongEvent,
  WebSocketPingEvent,
  WebSocketPongEvent,
  WebSocketEvent
} from "std/ws/mod.ts";

import { EventEmitter } from "mutevents";
import { Timeout } from "timeout"
import { Abort } from "abortable";

import { ChannelCloseError, WSChannel } from "./channel.ts";

import { CloseError, WSCloseMessage, WSMessage, WSOpenMessage } from "./message.ts";
import { UUID } from "../types.ts";

import * as UUIDs from "std/uuid/v4.ts"

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
  readonly channels = new Map<UUID, WSChannel>()

  readonly paths = new EventEmitter<{
    [path: string]: Message<unknown>
  }>()

  constructor(
    readonly socket: WebSocket
  ) {
    super();

    this.on(["message"],
      this.handlemessage.bind(this))

    this._listen()
      .catch(e => this.catch(e))
  }

  get closed() {
    return this.socket.isClosed;
  }

  async catch(e: unknown) {
    if (e instanceof ConnectionCloseError)
      return
    else if (e instanceof ChannelCloseError)
      await this.close(e.reason)
    else if (e instanceof Error)
      await this.close(e.message)
  }

  private async _listen() {
    for await (const e of this.socket)
      this.handle(e).catch(e => this.catch(e))

    const error =
      new ConnectionCloseError()
    await this.emit("close", error)
  }

  private async handle(e: WebSocketEvent) {
    if (isWebSocketPingEvent(e))
      await this.emit("ping", e)

    if (isWebSocketPongEvent(e))
      await this.emit("pong", e)

    if (isWebSocketCloseEvent(e)) {
      const error =
        new ConnectionCloseError(e.reason)
      await this.emit("close", error)
    }

    if (typeof e === "string") {
      const msg =
        JSON.parse(e) as WSMessage
      await this.emit("message", msg)
    }
  }

  private handleopen(msg: WSOpenMessage) {
    if (this.channels.has(msg.uuid))
      throw new Error("UUID already exists")

    const { uuid, path, data } = msg;
    const channel = new WSChannel(this, uuid)
    this.channels.set(uuid, channel)

    channel.once(["close"], () =>
      this.channels.delete(uuid))

    this.paths.emit(path, { channel, data })
      .catch(e => channel.catch(e))
  }

  private handlemessage(msg: WSMessage) {
    if (msg.type === "open") {
      this.handleopen(msg)
      return
    }

    const channel = this.channels.get(msg.uuid)
    if (!channel) throw new Error("Invalid UUID")

    if (msg.type === undefined) {
      channel.emit("message", msg.data)
        .catch(e => channel.catch(e))
    }

    if (msg.type === "close") {
      const error =
        new ChannelCloseError("OK")
      channel.emit("message", msg.data)
        .then(() => channel.emit("close", error))
        .catch(e => channel.catch(e))
    }

    if (msg.type === "error") {
      const error =
        new ChannelCloseError(msg.reason)
      channel.emit("close", error)
        .catch(e => channel.catch(e))
    }
  }

  async send(msg: WSMessage) {
    const text = JSON.stringify(msg);
    await this.socket.send(text);
  }

  async close(reason?: string) {
    await this.socket.close(1000, reason ?? "Unknown");
    const error =
      new ConnectionCloseError(reason)
    await this.emit("close", error)
  }

  /**
   * Wait for an open message on a path
   * @param path Path to listen on
   * @param delay Timeout delay
   * @throws CloseError | TimeoutError
   */
  async waitopen<T = unknown>(path: string, delay = 0) {
    const message = this.paths.wait([path])
    const close = this.error(["close"])

    if (delay > 0) {
      const msg =
        await Timeout.race([message, close], 1000)
      return msg as Message<T>
    } else {
      const msg =
        await Abort.race([message, close])
      return msg as Message<T>
    }
  }

  /**
   * Listen on a path
   * @param path Path to listen on
   * @yields Message
   * @throws CloseError
   */
  async* listen(path: string) {
    while (true) yield this.waitopen(path)
  }

  private genUUID() {
    while (true) {
      const uuid = UUIDs.generate()
      if (!this.channels.has(uuid))
        return uuid
    }
  }

  /**
   * Open a channel
   * @param path Path
   * @param data Data to send
   */
  async open(path: string, data?: unknown) {
    const uuid = this.genUUID()
    const channel = new WSChannel(this, uuid)

    const message: WSMessage =
      { uuid, type: "open", path, data }

    await this.send(message)

    this.channels.set(uuid, channel)

    channel.once(["close"], () =>
      this.channels.delete(uuid))

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