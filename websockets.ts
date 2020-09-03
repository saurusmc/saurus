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

import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts";
import { Random } from "https://deno.land/x/random@v1.1.2/Random.js";

const random = new Random();

export class WSHandler extends EventEmitter<{
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

        const connection = new WSConnection(socket);
        this.emit("accept", connection);
      } catch (e) {
        await req.respond({ status: 400 });
      }
    }
  }
}

export class WSConnection extends EventEmitter<{
  message: [WSData]
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
        this.emit("message", data)
    } catch (e) {
      if (!isWebSocketCloseEvent(e)) throw e;
      this.emit("close", e.reason)
    }
  }

  async read() {
    for await (const data of this)
      return data;
  }

  async write(data: any) {
    const text = JSON.stringify(data);
    await this.socket.send(text);
  }

  get closed() {
    return this.socket.isClosed;
  }

  async close(reason = "") {
    if (this.closed) return;
    await this.socket.close(1000, reason);
  }
}

export interface WSData {
  channel: string,
  code: string,
  content: any
}

export type WSChannelStatus = "none" | "opening" | "ready" | "closed"

export class WSChannel extends EventEmitter<{
  message: [any]
  ready: []
  close: [string | undefined]
}>{
  status: WSChannelStatus = "none"

  constructor(
    readonly conn: WSConnection,
    readonly channel = random.string(10)
  ) {
    super()

    conn.on(["message"], this.onmessage.bind(this))
    conn.on(["close"], this.onclose.bind(this))
  }

  get closed() {
    return this.status === "closed";
  }

  private async onready() {
    this.status = "ready"
    await this.emit("ready")
  }

  private async onclose(reason?: string) {
    this.status = "closed"
    await this.emit("close", reason)
  }

  private async onmessage(data: WSData) {
    if (this.closed) return;

    const { channel, code, content } = data;
    if (channel !== this.channel) return;

    if (code === "ready") {
      await this.onready()
      return;
    }

    if (code === "close") {
      await this.onclose(content)
      return;
    }

    if (code === "message") {
      await this.emit("message", content);
      return;
    }
  }

  async write(content: any, code = "message") {
    if (this.closed) return;

    const { channel } = this;
    const data: WSData = { channel, code, content }
    await this.conn.write(data);
  }

  async open(reason?: string) {
    if (this.status !== "none") return;

    await this.write(reason, "open")
    this.status = "opening"
  }

  async ready() {
    if (this.status !== "opening") return

    await this.write(undefined, "ready")
    await this.onready()
  }

  async close(reason?: string) {
    if (this.closed) return;

    await this.write(reason, "close")
    await this.onclose(reason)
  }
}