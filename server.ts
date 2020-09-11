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
  message: [string, unknown]
  close: [string | undefined]
}> {
  players = new Players(this)

  events = new EventEmitter<{
    "player.join": [PlayerEvent]
    "player.quit": [PlayerEvent]
    "player.death": [PlayerEvent]
  }>()

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
      console.log(data)
      const { type, ...e } = data as any
      await this.events.emit(type, e)
      return;
    }

    await this.emit("message", channel, data)
  }

  async execute(command: string) {
    const channel = new WSChannel(this.conn)
    channel.write({ action: "execute", command })
    const done = await channel.wait() as boolean;
    console.log(done)
  }

}