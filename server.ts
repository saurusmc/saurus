import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"

import { WSConnection, WSChannel } from "./websockets.ts";
import { Players } from "./players.ts";

export interface Event {
  [x: string]: any
}

export interface PlayerEvent extends Event {
  player: {
    uuid: string,
    name: string
  }
}

export class Server extends EventEmitter<{
  open: [WSChannel]
  close: [string | undefined]
}> {
  events = new EventEmitter<{
    "player.join": [PlayerEvent]
    "player.quit": [PlayerEvent]
    "player.death": [PlayerEvent]
  }>()

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

  private async onmessage(id: string, data: unknown) {
    if (id === "event") {
      console.log(data)
      const { type, ...e } = data as any
      await this.events.emit(type, e)
      return;
    }

    if (data === "open") {
      const channel = new WSChannel(this.conn, id)
      await this.emit("open", channel)
      return;
    }
  }

  async execute(command: string) {
    const channel = new WSChannel(this.conn)
    channel.write({ action: "execute", command })
    const done = await channel.wait() as boolean;
    console.log(done)
  }

}