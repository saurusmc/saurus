import {
  HTTPOptions,
  HTTPSOptions,
  serve,
  ServerRequest,
  serveTLS,
} from "std/http/server.ts";

import { acceptWebSocket } from "std/ws/mod.ts";

import { EventEmitter } from "mutevents";
import { ConnectionCloseError, WSConnection } from "./connection.ts";
import { ChannelCloseError } from "./channel.ts";

export type { HTTPSOptions } from "std/http/server.ts"

export interface ListenOptions {
  hostname?: string
  port: number,
  certFile?: string
  keyFile?: string
}

function isHTTPS(options: ListenOptions): options is HTTPSOptions {
  return Boolean(options.certFile) && Boolean(options.keyFile)
}

export class WSServer extends EventEmitter<{
  accept: WSConnection
}> {
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
      this.emit("accept", conn)
        .catch(e => conn.catch(e))
    } catch (e) {
      await req.respond({ status: 400 });
    }
  }
}