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
  message: [string, unknown]
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
      for await (const msg of this) {
        const { channel, data } = msg
        if (typeof channel !== "string") continue;
        await this.emit("message", channel, data)
      }
    } catch (e) {
      if (isWebSocketCloseEvent(e)) {
        await this.emit("close", e.reason)
      }

      if (e instanceof Error) {
        await this.close(e.message)
      }

      throw e;
    }
  }

  async read() {
    for await (const data of this)
      return data;
  }

  async wait(channel: string) {
    return await new Promise<unknown>((ok, err) => {
      const off1 = this.once(["message"], (c, d) => { c === channel && off2() && ok(d) })
      const off2 = this.once(["close"], (r) => { off1() && err(r) })
    })
  }

  async write(channel: string, data: unknown) {
    if (this.closed) return;
    const msg = { channel, data }
    const text = JSON.stringify(msg);
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