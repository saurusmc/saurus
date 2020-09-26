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

export class WSConnection extends EventEmitter<{
  message: [msg: WSMessage]
  close: [e: Close]
}> {

  readonly channels = new EventEmitter<{
    [path: string]: [channel: WSChannel, data: unknown]
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
      await this.channels.emit(path, channel, data)
    }
  }

  async read() {
    if (this.closed)
      throw new Error("Closed")

    return await new Promise<WSMessage>((ok, err) => {
      const off1 = this.once(["message"],
        (msg) => { off2(); ok(msg) })

      const off2 = this.once(["close"],
        (close) => { off1(); err(close) })
    })
  }

  async wait<T>(path: string) {
    if (this.closed)
      throw new Error("Closed")

    return await new Promise<[WSChannel, T]>((ok, err) => {
      const off1 = this.channels.once([path],
        (c, d) => { off2(); ok([c, d as T]) })

      const off2 = this.once(["close"],
        (close) => { off1(); err(close) })
    })
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