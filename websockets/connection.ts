import {
  WebSocket,
  isWebSocketPingEvent,
  isWebSocketCloseEvent
} from "https://deno.land/std@0.65.0/ws/mod.ts";

import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts";
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

export class WSConnection extends EventEmitter<{
  message: WSMessage
  close: Close
}> {

  readonly channels = new EventEmitter<{
    [path: string]: Message
  }>()

  constructor(
    readonly socket: WebSocket
  ) {
    super();

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
        if (isWebSocketCloseEvent(e)) throw e;
        if (isWebSocketPingEvent(e)) continue;
        if (typeof e !== "string") continue;
        this.onmessage(JSON.parse(e) as WSMessage)
      }

      await this.emit("close", new Close("Unknown"))
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

  async read() {
    const message = this.wait(["message"])
    const close = this.error(["close"])
    return await Abort.race([message, close])
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

  async open(path: string, data?: unknown) {
    const channel = new WSChannel(this)
    await channel.open(path, data)
    return channel
  }

  async request<T>(path: string, req?: unknown) {
    const channel = new WSChannel(this)
    await channel.open(path, req)
    const res = await channel.read<T>()
    return res;
    // return { channel, data: res } as Message<T>;
  }
}