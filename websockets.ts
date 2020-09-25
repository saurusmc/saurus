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
import { timeout as Timeout } from "https://deno.land/x/timeout@1.0/mod.ts"
import * as UUID from "https://deno.land/std@0.70.0/uuid/v4.ts"

export type { HTTPSOptions } from "https://deno.land/std@0.65.0/http/server.ts"

export class WSServer extends EventEmitter<{
  accept: [conn: WSConnection]
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

export class Close {
  constructor(readonly reason?: string) { }
}

export class WSConnection extends EventEmitter<{
  open: [{ channel: WSChannel, path: string, data: unknown }]
  message: [msg: WSMessage]
  close: [e: Close]
}> {
  constructor(
    readonly socket: WebSocket
  ) {
    super();

    this.listen()
  }

  async *[Symbol.asyncIterator]() {
    while (true) yield await this.read()
  }

  get closed() {
    return this.socket.isClosed;
  }

  private async listen() {
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
      await this.emit("open", { channel, path, data })
    }
  }

  async wait<T>(path: string) {
    if (this.closed)
      throw new Error("Closed")

    return await new Promise<[WSChannel, T]>((ok, err) => {
      const off1 = this.once(["open"], (e) => {
        if (e.path !== path) return
        const { channel, data } = e
        ok([channel, data as T])
        off2();
      })

      const off2 = this.once(["close"], e => { off1(); err(e) })
    })
  }

  async read() {
    if (this.closed)
      throw new Error("Closed")

    return await new Promise<WSMessage>((ok, err) => {
      const off1 = this.once(["message"],
        (msg) => { off2(); ok(msg) })

      const off2 = this.once(["close"],
        (reason?) => { off1(); err(reason) })
    })
  }

  async open(path: string, data?: unknown) {
    const channel = new WSChannel(this)
    await channel.open(path, data)
    return channel
  }

  async send(msg: WSMessage) {
    if (this.closed)
      throw new Error("Closed")

    const text = JSON.stringify(msg);
    await this.socket.send(text);
  }

  async close(reason = "Closed") {
    if (this.closed)
      throw new Error("Closed")

    await this.socket.close(1000, reason);
    await this.emit("close", new Close(reason))
  }
}

export type WSMessage = WSOpenMessage | WSOtherMessage | WSCloseMessage | WSErrorMessage

export interface WSOpenMessage {
  uuid: string
  type: "open"
  path: string
  data: unknown
}

export interface WSOtherMessage {
  uuid: string
  type: "other"
  data: unknown
}

export interface WSCloseMessage {
  uuid: string,
  type: "close"
  data: unknown
}

export interface WSErrorMessage {
  uuid: string
  type: "error"
  reason?: string
}

export class WSChannel extends EventEmitter<{
  message: [data: unknown]
  close: [e: Close]
}> {
  private offmessage: () => unknown

  constructor(
    readonly conn: WSConnection,
    readonly uuid = UUID.generate()
  ) {
    super()

    this.offmessage = conn.on(["message"],
      this.onmessage.bind(this))

    conn.once(["close"], e => this.emit("close", e))
    this.once(["close"], this.onclose.bind(this))
  }

  async *[Symbol.asyncIterator]() {
    while (true) yield await this.read()
  }

  private async onmessage(msg: WSMessage) {
    if (msg.uuid !== this.uuid) return;

    if (msg.type === "other") {
      await this.emit("message", msg.data)
    }

    if (msg.type === "close") {
      await this.emit("message", msg.data)
      await this.emit("close", new Close("OK"))
    }

    if (msg.type === "error") {
      await this.emit("close", new Close(msg.reason))
    }
  }

  private async onclose() {
    this.offmessage()
  }

  async open(path: string, data?: unknown) {
    const { conn, uuid } = this
    await conn.send({ uuid, type: "open", path, data })
  }

  async close(data?: unknown) {
    const { conn, uuid } = this;

    await conn.send({ uuid, type: "close", data })
  }

  async error(reason?: string) {
    const { conn, uuid } = this;

    await conn.send({ uuid, type: "error", reason })
  }

  async send(data?: unknown) {
    const { conn, uuid } = this;

    await conn.send({ uuid, type: "other", data })
  }

  async read<T = unknown>() {
    return await new Promise<T>((ok, err) => {
      const off1 = this.once(["message"],
        (data) => { off2(); ok(data as T) })

      const off2 = this.once(["close"],
        (reason?) => { off1(); err(reason) })
    })
  }
}