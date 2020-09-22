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
  message: [WSMessage]
  close: [string | undefined]
}> {
  constructor(
    readonly socket: WebSocket
  ) {
    super();

    this.listen()
  }

  private async listen() {
    try {
      for await (const e of this.socket) {
        if (isWebSocketCloseEvent(e)) throw e;
        if (isWebSocketPingEvent(e)) continue;
        if (typeof e !== "string") continue;

        const data = JSON.parse(e);
        await this.emit("message", data)
      }
    } catch (e) {
      console.error(e)
      if (isWebSocketCloseEvent(e))
        await this.emit("close", e.reason)
      if (e instanceof Error)
        await this.close(e.message)
    }
  }

  async read() {
    return await new Promise<WSMessage>((ok, err) => {
      const off1 = this.once(["message"], m => { off2(); ok(m) })
      const off2 = this.once(["close"], r => { off1(); err(r) })
    })
  }

  async *[Symbol.asyncIterator]() {
    while (true) yield await this.read()
  }

  async write(msg: WSMessage) {
    if (this.closed) return;
    const text = JSON.stringify(msg);
    await this.socket.send(text);
  }

  async wait(timeout = 1000) {
    return await Timeout(this.read(), timeout)
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

export interface WSMessage {
  channel: string
  method?: "open" | "close"
  action?: string
  data: unknown
}

export class WSChannel extends EventEmitter<{
  message: [unknown]
  close: [string | undefined]
}> {
  constructor(
    readonly conn: WSConnection,
    readonly channel = UUID.generate()
  ) {
    super()

    const offmessage =
      conn.on(["message"], d => this.onmessage(d))

    conn.once(["close"], (r) => {
      offmessage()
      this.onconnclose(r)
    })
  }

  async open(action: string, data: unknown) {
    const open: WSMessage = {
      channel: this.channel,
      method: "open",
      action,
      data,
    }

    await this.conn.write(open)
  }

  async close(reason?: string) {
    const close: WSMessage = {
      channel: this.channel,
      method: "close",
      data: reason,
    }

    await this.conn.write(close)
  }

  private async onmessage(msg: WSMessage) {
    if (msg.channel !== this.channel) return;

    if (msg.method === "close") {
      const reason = msg.data as string | undefined
      await this.emit("close", reason)
      return;
    }

    if (!msg.method) {
      await this.emit("message", msg.data)
      return;
    }
  }

  private async onconnclose(reason?: string) {
    await this.emit("close", reason)
  }

  async write(data: any) {
    const { conn, channel } = this;
    await conn.write({ channel, data })
  }

  async read<T = unknown>() {
    return await new Promise<T>((ok, err) => {
      const off1 = this.once(["message"], d => { off2(); ok(d as T) })
      const off2 = this.once(["close"], r => { off1(); err(r) })
    })
  }

  async *[Symbol.asyncIterator]() {
    while (true) yield await this.read()
  }

  async wait<T = unknown>(timeout = 1000) {
    return await Timeout(this.read<T>(), timeout)
  }
}