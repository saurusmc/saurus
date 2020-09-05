import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"

import { WSConnection } from "./websockets.ts";
import { Players } from "./players.ts";

export interface ServerEvent {
  type: string,
  [x: string]: any
}

export class Server extends EventEmitter<{
  message: [string, unknown]
  event: [ServerEvent]
  close: [string | undefined]
}> {

  players = new Players(this)

  constructor(
    readonly conn: WSConnection
  ) {
    super()

    conn.on(["close"], this.onclose.bind(this))
    conn.on(["message"], this.onmessage.bind(this))

    conn.listen()
  }

  private async onclose(reason?: string) {
    console.log(`Closed: ${reason}`)
    await this.emit("close", reason)
  }

  private async onmessage(channel: string, data: unknown) {
    if (channel === "event") {
      const e = data as ServerEvent
      await this.emit("event", e)
      return;
    }

    await this.emit("message", channel, data)
  }

  async write(channel: string, data: unknown) {
    await this.conn.write(channel, data)
  }

  async wait(channel: string) {
    return await this.conn.wait(channel)
  }

}