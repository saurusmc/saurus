import {
  HTTPSOptions,
  serveTLS,
} from "https://deno.land/std@0.65.0/http/server.ts";

import {
  acceptWebSocket,
  WebSocket
} from "https://deno.land/std@0.65.0/ws/mod.ts";

import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts";
import { WSConnection } from "./connection.ts";

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