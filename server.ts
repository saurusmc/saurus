import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"

import { Players } from "./players.ts";
import { Connection } from "./connection.ts";

import type { PlayerInfo } from "./player.ts";
import type { WSConnection } from "./websockets/connection.ts";

export interface Event {
  event: string
}

export interface Location {
  x: number
  y: number
  z: number
}

export interface PlayerEvent extends Event {
  player: PlayerInfo
  location: Location
}

export interface PlayerMessageEvent extends PlayerEvent {
  message: string
}

export interface PlayerRespawnEvent extends PlayerEvent {
  anchor: boolean
  bed: boolean
}

export interface PlayerMoveEvent extends PlayerEvent {
  from: Location
  to: Location
}

export interface PlayerChatEvent extends PlayerEvent {
  format: string,
  message: string
}

export interface PlayerCodeEvent extends PlayerEvent {
  code: string
}

export class Server extends Connection {
  events = new EventEmitter<{
    [x: string]: {}
    "player.join": PlayerMessageEvent
    "player.quit": PlayerMessageEvent
    "player.death": PlayerMessageEvent
    "player.respawn": PlayerRespawnEvent
    "player.move": PlayerMoveEvent
    "player.chat": PlayerChatEvent
    "player.code": PlayerCodeEvent
  }>()

  players = new Players(this)

  constructor(
    readonly conn: WSConnection,
    readonly name: string,
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
}