import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"

import { WSConnection, WSData, WSChannel } from "./websockets.ts";
import { Players } from "./players.ts";

export interface ServerEvent {
  type: string,
  [x: string]: any
}

export class Server extends EventEmitter<{
  open: [WSChannel, string | undefined]
  event: [ServerEvent]
}> {
  players = new Players(this)

  constructor(
    readonly conn: WSConnection
  ) {
    super()

    conn.on(["close"], this.onclose.bind(this))
    conn.on(["message"], this.onmessage.bind(this))
    this.on(["open"], this.onopen.bind(this))

    conn.listen()
  }

  private async onclose(reason?: string) {
    console.log(`Closed: ${reason}`)
  }

  private async onmessage(data: WSData) {
    const { conn } = this;
    const { channel, code, content } = data;

    if (code === "open") {
      const wsc = new WSChannel(conn, channel)
      wsc.status = "opening"
      await wsc.ready()

      const reason = content as string | undefined;
      await this.emit("open", wsc, reason);
      return;
    }
  }

  private async onopen(wsc: WSChannel, reason?: string) {
    if (wsc.channel === "events") {
      wsc.on(["message"], (e) => this.emit("event", e))
      return;
    }
  }

}