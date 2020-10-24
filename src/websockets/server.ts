import {
  HTTPOptions,
  HTTPSOptions,
  serve,
  ServerRequest,
  serveTLS,
} from "std/http/server.ts";

import { acceptWebSocket } from "std/ws/mod.ts";

import { EventEmitter } from "mutevents/mod.ts";
import { WSConnection } from "./connection.ts";

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
  accept: WSConnection
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

      const conn = new WSConnection(socket)

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