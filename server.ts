import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"

import { Players } from "./players.ts";
import { Connection } from "./connection.ts";
import { WSChannel } from "./websockets/channel.ts";

import type { PlayerInfo } from "./player.ts";
import type { WSConnection } from "./websockets/connection.ts";

export interface Event {
  event: string
}

export interface PlayerEvent extends Event {
  player: PlayerInfo
}


export class Server extends Connection {
  events = new EventEmitter<{
    "player.join": [PlayerEvent]
    "player.quit": [PlayerEvent]
    "player.death": [PlayerEvent]
    [x: string]: [Event]
  }>()

  players = new Players(this)

  constructor(
    readonly conn: WSConnection,
    readonly platform: string
  ) {
    super(conn)

    this.listenevents()
  }

  private async listenevents() {
    const events = await this.open("/events")

    const offmessage = events.on(["message"],
      (d) => this.onevent(d as Event))

    events.once(["close"], offmessage)
  }

  private async onevent(e: Event) {
    await this.events.emit(e.event, e)
  }

  async execute(command: string) {
    const done: boolean =
      await this.request("/execute", command)

    return done;
  }

}