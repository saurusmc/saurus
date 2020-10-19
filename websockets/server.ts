import {
  HTTPOptions,
  HTTPSOptions,
  serve,
  serveTLS,
} from "std/http/server.ts";

import { acceptWebSocket } from "std/ws/mod.ts";

import { EventEmitter } from "mutevents";
import { WSConnection } from "./connection.ts";

export type { HTTPSOptions } from "std/http/server.ts"

export interface ListenOptions {
  hostname?: string
  port: number,
  certFile?: string
  keyFile?: string
}

function isHTTPS(options: ListenOptions): options is HTTPSOptions {
  return Boolean(options.certFile && options.keyFile)
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
    for await (const req of serve(options)) {
      try {
        const socket = await acceptWebSocket({
          conn: req.conn,
          bufReader: req.r,
          bufWriter: req.w,
          headers: req.headers,
        })

        this.onaccept(new WSConnection(socket));
      } catch (e) {
        await req.respond({ status: 400 });
      }
    }
  }

  private async listenTLS(options: HTTPSOptions) {
    for await (const req of serveTLS(options)) {
      try {
        const socket = await acceptWebSocket({
          conn: req.conn,
          bufReader: req.r,
          bufWriter: req.w,
          headers: req.headers,
        })

        this.onaccept(new WSConnection(socket));
      } catch (e) {
        await req.respond({ status: 400 });
      }
    }
  }

  private async onaccept(conn: WSConnection) {
    try {
      await this.emit("accept", conn)
    } catch (e) {
      if (e instanceof Error)
        await conn.close(e.message)
      else
        await conn.close()
    }
  }
}