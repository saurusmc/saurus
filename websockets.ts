import {
  HTTPSOptions,
  serveTLS,
} from "https://deno.land/std@0.65.0/http/server.ts";

import {
  acceptWebSocket,
  WebSocket,
  isWebSocketPingEvent,
  isWebSocketCloseEvent
} from "https://deno.land/std@0.65.0/ws/mod.ts";

import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts";
import { Random } from "https://deno.land/x/random@v1.1.2/Random.js";
import { timeout as Timeout } from "https://deno.land/x/timeout@1.0/mod.ts"

export type { HTTPSOptions } from "https://deno.land/std@0.65.0/http/server.ts"

export class WSServer extends EventEmitter<{
  accept: [WSConnection]
}> {
  constructor(
    readonly options: HTTPSOptions,
  ) {
    super();

    this.listen();
  }

  private async listen() {
    for await (const req of serveTLS(this.options)) {
      const { conn, r: bufReader, w: bufWriter, headers } = req;

      try {
        const socket = await acceptWebSocket({
          conn,
          bufReader,
          bufWriter,
          headers,
        });

        this.accept(new WSConnection(socket))
      } catch (e) {
        await req.respond({ status: 400 });
      }
    }
  }

  private async accept(conn: WSConnection) {
    try {
      await this.emit("accept", conn)
    } catch (e) {
      console.error(e)
      if (e instanceof Error)
        conn.close(e.message)
      else conn.close()
    }
  }
}

export class WSConnection extends EventEmitter<{
  message: [WSCMessage]
  close: [string | undefined]
}> {
  constructor(
    readonly socket: WebSocket
  ) {
    super();
  }

  private async *[Symbol.asyncIterator]() {
    for await (const e of this.socket) {
      if (isWebSocketCloseEvent(e)) throw e;
      if (isWebSocketPingEvent(e)) continue;
      if (typeof e !== "string") continue;

      const data = JSON.parse(e);
      yield data;
    }
  }

  async listen() {
    try {
      for await (const data of this)
        await this.emit("message", data)
    } catch (e) {
      console.error(e)
      if (isWebSocketCloseEvent(e))
        await this.emit("close", e.reason)
      if (e instanceof Error)
        await this.close(e.message)
    }
  }

  async read() {
    for await (const data of this)
      return data
  }

  async write(data: unknown) {
    if (this.closed) return;
    const text = JSON.stringify(data);
    await this.socket.send(text);
  }

  get closed() {
    return this.socket.isClosed;
  }

  async close(reason = "") {
    if (this.closed) return
    await this.emit("close", reason)
    await this.socket.close(1000, reason);
  }
}

export type WSCMessage = WSOpenMessage | WSCloseMessage | WSCOtherMessage

export interface WSOpenMessage {
  channel: string,
  method: "open",
  action: string,
  data: unknown
}

export interface WSCloseMessage {
  channel: string,
  method: "close",
  reason?: string
}

export interface WSCOtherMessage {
  channel: string
  method: "none"
  data: unknown
}

export class WSChannel extends EventEmitter<{
  message: [unknown]
  close: [string | undefined]
}> {
  constructor(
    readonly conn: WSConnection,
    readonly id = new Random().string(10)
  ) {
    super()

    conn.on(["message"], this.onmessage.bind(this))
    conn.on(["close"], this.onconnclose.bind(this))
  }

  async open(action: string, data: unknown) {
    const open: WSOpenMessage = {
      channel: this.id,
      method: "open",
      action,
      data,
    }

    await this.conn.write(open)
  }

  async close(reason?: string) {
    const close: WSCloseMessage = {
      channel: this.id,
      method: "close",
      reason,
    }

    await this.conn.write(close)
  }

  private async onmessage(msg: WSCMessage) {
    if (msg.channel !== this.id) return;

    if (msg.method === "close") {
      await this.emit("close", msg.reason)
      return;
    }

    if (msg.method === "none") {
      await this.emit("message", msg.data)
      return;
    }
  }

  private async onconnclose(reason?: string) {
    await this.emit("close", reason)
  }

  async write(data: any) {
    const other: WSCOtherMessage = {
      channel: this.id,
      method: "none",
      data
    }

    await this.conn.write(other)
  }

  async wait<T = unknown>(timeout = 1000) {
    const promise = new Promise<T>((ok, err) => {
      const off1 = this.once(["message"], (d) => { off2() && ok(d as T) })
      const off2 = this.once(["close"], (r) => { off1() && err(r) })
    })

    return await Timeout(promise, timeout)
  }
}