import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"

import { Players } from "./players.ts";
import { Connection } from "./connection.ts";

import type { PlayerInfo } from "./player.ts";
import type { WSConnection } from "./websockets/connection.ts";

export interface Event {
  event: string
}

export interface PlayerEvent extends Event {
  player: PlayerInfo
}

export interface CodeEvent extends PlayerEvent {
  code: string
}

export class Server extends Connection {
  events = new EventEmitter<{
    "player.join": PlayerEvent
    "player.quit": PlayerEvent
    "player.death": PlayerEvent
    "player.code": CodeEvent
    [x: string]: {}
  }>()

  players = new Players(this)

  constructor(
    readonly conn: WSConnection,
    readonly platform: string,
    readonly password: string,
  ) {
    super(conn)

    this.listenevents()
  }

  private async listenevents() {
    const events = await this.open("/events")

    const off = events.on(["message"],
      (d) => this.onevent(d as Event))

    events.once(["close"], off)
  }

  private async onevent(e: Event) {
    await this.events.emit(e.event, e)
  }

  async execute(command: string) {
    return await this.request<boolean>("/execute", command)
  }

  list() {
    return this.players.list()
  }

  player(player: PlayerInfo) {
    return this.players.get(player)
  }
}