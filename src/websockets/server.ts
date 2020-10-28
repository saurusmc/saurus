import {
  HTTPOptions,
  HTTPSOptions,
  serve,
  ServerRequest,
  serveTLS,
} from "std/http/server.ts";

import { acceptWebSocket, isWebSocketCloseEvent, isWebSocketPingEvent, isWebSocketPongEvent, WebSocket, WebSocketEvent } from "std/ws/mod.ts";

import { EventEmitter } from "mutevents/mod.ts";
import { WSConn } from "./conn.ts";
import { WSMessage } from "./types.ts";
import { ConnectionCloseError } from "./errors.ts";

export type { HTTPSOptions } from "std/http/server.ts"

export interface ListenOptions {
  port: number,
  hostname?: string
  certFile?: string
  keyFile?: string
}

function isHTTPS(options: ListenOptions): options is HTTPSOptions {
  return Boolean(options.certFile) && Boolean(options.keyFile)
}

export interface WSServerEvents {
  accept: WSServerConn
}

export class WSServer extends EventEmitter<WSServerEvents> {
  constructor(
    options: ListenOptions,
  ) {
    super();

    if (isHTTPS(options))
      this.listenTLS(options);
    else
      this.listen(options)
  }

  private async listen(options: HTTPOptions) {
    for await (const req of serve(options))
      this.handle(req)
  }

  private async listenTLS(options: HTTPSOptions) {
    for await (const req of serveTLS(options))
      this.handle(req)
  }

  private async handle(req: ServerRequest) {
    try {
      const socket = await acceptWebSocket({
        conn: req.conn,
        bufReader: req.r,
        bufWriter: req.w,
        headers: req.headers,
      })

      const conn = new WSServerConn(socket)

      try {
        await this.emit("accept", conn)
      } catch (e: unknown) {
        await conn.catch(e)
      }
    } catch (e: unknown) {
      await req.respond({ status: 400 });
    }
  }
}

export class WSServerConn extends WSConn {
  constructor(readonly socket: WebSocket) {
    super()

    this._listen()
      .catch(e => this.catch(e))
  }

  get closed() { return this.socket.isClosed }

  async ping() {
    await this.socket.ping()
  }

  async send(msg: WSMessage) {
    const text = JSON.stringify(msg);
    await this.socket.send(text);
  }

  async close(reason?: string) {
    await this.socket.close(1000, reason ?? "");
    await this.emit("close",
      new ConnectionCloseError(reason))
  }

  private async _listen() {
    for await (const e of this.socket) {
      this._handle(e)
        .catch(e => this.catch(e))
    }

    await this.emit("close",
      new ConnectionCloseError())
  }

  private async _handle(e: WebSocketEvent) {
    if (isWebSocketPingEvent(e))
      await this.emit("ping", e)

    if (isWebSocketPongEvent(e))
      await this.emit("pong", e)

    if (isWebSocketCloseEvent(e))
      await this.emit("close",
        new ConnectionCloseError(e.reason))

    if (typeof e === "string")
      await this.emit("message",
        JSON.parse(e) as WSMessage)
  }
}