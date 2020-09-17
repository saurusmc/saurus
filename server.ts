import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"

import { WSConnection, WSChannel } from "./websockets.ts";
import { Players } from "./players.ts";
import { Connection } from "./connection.ts";
import type { PlayerInfo } from "./player.ts";

export interface PlayerEvent {
  player: PlayerInfo
}

export class Server extends Connection {
  events = new EventEmitter<{
    "player.join": [PlayerEvent]
    "player.quit": [PlayerEvent]
    "player.death": [PlayerEvent]
  }>()

  players = new Players(this)

  constructor(
    readonly conn: WSConnection,
    readonly platform: string
  ) {
    super(conn)

    const events = new WSChannel(this.conn, "event")
    events.on(["message"], this.onevent.bind(this))
  }

  protected async onclose(reason?: string) {
    super.onclose(reason)
    console.log(`Closed: ${reason}`)
  }

  private async onevent(data: unknown) {
    console.log("event", data)
    const { type, ...e } = data as any
    await this.events.emit(type, e)
    return;
  }

  async execute(command: string) {
    const channel = await this.open("execute", command)
    const done = await channel.wait<boolean>();
    return done;
  }

}