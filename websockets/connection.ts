import {
  WebSocket,
  isWebSocketPingEvent,
  isWebSocketCloseEvent
} from "https://deno.land/std@0.65.0/ws/mod.ts";

import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts";

import { WSChannel } from "./channel.ts";

import type { WSMessage } from "./message.ts";

export class Close {
  constructor(readonly reason?: string) { }
}

export interface WSRequest<T = unknown> {
  channel: WSChannel,
  data: T
}

export class WSConnection extends EventEmitter<{
  message: [msg: WSMessage]
  close: [e: Close]
}> {

  readonly channels = new EventEmitter<{
    [path: string]: [WSRequest]
  }>()

  constructor(
    readonly socket: WebSocket
  ) {
    super();

    this._listen()
  }

  async *[Symbol.asyncIterator]() {
    while (true) yield await this.read()
  }

  get closed() {
    return this.socket.isClosed;
  }

  private async _listen() {
    try {
      for await (const e of this.socket) {
        if (isWebSocketCloseEvent(e)) throw e;
        if (isWebSocketPingEvent(e)) continue;
        if (typeof e !== "string") continue;
        this.onmessage(JSON.parse(e) as WSMessage)
      }
    } catch (e) {
      if (isWebSocketCloseEvent(e))
        await this.emit("close", new Close(e.reason))
      if (e instanceof Error)
        await this.close(e.message)
    }
  }

  protected async onmessage(msg: WSMessage) {
    await this.emit("message", msg)

    if (msg.type === "open") {
      const { uuid, path, data } = msg;
      const channel = new WSChannel(this, uuid)
      await this.channels.emit(path, { channel, data })
    }
  }

  async read() {
    let off1: () => unknown
    let off2: () => unknown

    const promise = new Promise<WSMessage>((ok, err) => {
      off1 = this.once(["message"], ok)
      off2 = this.once(["close"], err)
    })

    const clean = () => { off1(); off2() }
    return await promise.finally(clean)
  }

  async wait<T>(path: string) {
    let off1: () => unknown
    let off2: () => unknown

    const promise = new Promise<WSRequest>((ok, err) => {
      off1 = this.channels.once([path], ok)
      off2 = this.once(["close"], err)
    }) as Promise<WSRequest<T>>

    const clean = () => { off1(); off2() }
    return await promise.finally(clean)
  }

  async* listen<T>(path: string) {
    while (true) yield await this.wait<T>(path)
  }

  async open(path: string, data?: unknown) {
    const channel = new WSChannel(this)
    await channel.open(path, data)
    return channel
  }

  async request<T>(path: string, data?: unknown) {
    const channel = await this.open(path, data)
    return await channel.read<T>()
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
}