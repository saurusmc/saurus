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
        await this.close(e.reason)
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

export interface WSCMessage {
  channel: string,
  method: string,
  data: unknown
}

export class WSChannel extends EventEmitter<{
  message: [unknown]
  close: [any]
}> {
  constructor(
    readonly conn: WSConnection,
    readonly id = new Random().string(10)
  ) {
    super()

    conn.on(["message"], this.onmessage.bind(this))
    conn.on(["close"], this.onconnclose.bind(this))
  }

  async open(data: any){
    await this.write(data, "open")
  }

  async close(data: any){
    await this.write(data, "close")
  }

  private async onmessage(msg: WSCMessage) {
    const { channel, method, data } = msg
    if (channel !== this.id) return;

    if(method === "close") {
      await this.emit("close", data)
      return;
    }

    await this.emit("message", data)
  }

  private async onconnclose(reason?: string){
    await this.emit("close", reason)
  }

  async write(data: any, method?: string) {
    const channel = this.id
    await this.conn.write({ channel, method, data })
  }

  async wait<T = unknown>() {
    return await new Promise<T>((ok, err) => {
      const off1 = this.once(["message"], (d) => { off2() && ok(d as T) })
      const off2 = this.once(["close"], (r) => { off1() && err(r) })
    })
  }
}