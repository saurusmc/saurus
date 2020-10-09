import {
  HTTPOptions,
  HTTPSOptions,
  serve,
  serveTLS,
} from "https://deno.land/std@0.65.0/http/server.ts";

import {
  acceptWebSocket,
  WebSocket
} from "https://deno.land/std@0.65.0/ws/mod.ts";

import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts";
import { WSConnection } from "./connection.ts";

export type { HTTPSOptions } from "https://deno.land/std@0.65.0/http/server.ts"

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
        const { conn, r, w, headers } = req;
        const socket = await acceptWebSocket({
          conn,
          bufReader: r,
          bufWriter: w,
          headers,
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
        const { conn, r, w, headers } = req;
        const socket = await acceptWebSocket({
          conn,
          bufReader: r,
          bufWriter: w,
          headers,
        })

        this.onaccept(new WSConnection(socket));
      } catch (e) {
        console.error(e)
        await req.respond({ status: 400 });
      }
    }
  }

  private async onaccept(conn: WSConnection) {
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