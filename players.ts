import { EventEmitter } from "mutevents"

import type { Server } from "./server.ts"
import { Player } from "./player.ts"
import { PlayerInfo } from "./types.ts"
import { isMinecraftEvent, MinecraftEvent, OtherEvent, PlayerJoinEvent, PlayerQuitEvent } from "./events.ts"

export interface PlayersEvents {
  join: Player
  quit: Player
}

export class Players extends EventEmitter<PlayersEvents> {
  uuids = new Map<string, Player>()
  names = new Map<string, Player>()

  constructor(readonly server: Server) {
    super()

    const offevent = server.on(["event"],
      this.onevent.bind(this))

    server.once(["close"], offevent)
  }

  list(features: string[]) {
    const infos = new Array<PlayerInfo>()
    for (const player of this.uuids.values())
      infos.push(player.extra(features))
    return infos
  }

  get(player: PlayerInfo) {
    return this.uuids.get(player.uuid)
      || this.names.get(player.name)
  }

  private async onevent(e: MinecraftEvent | OtherEvent) {
    if (!isMinecraftEvent(e)) return;

    if (e.event === "player.join")
      await this.onjoin(e)
    if (e.event === "player.quit")
      await this.onquit(e)
  }

  async onjoin(e: PlayerJoinEvent) {
    const { name, uuid } = e.player;
    const player = new Player(this.server, name, uuid)
    const cancelled = await this.emit("join", player)

    if (cancelled) {
      await player.kick(cancelled.reason)
    } else {
      this.names.set(name, player)
      this.uuids.set(uuid, player)
    }
  }

  async onquit(e: PlayerQuitEvent) {
    const { name, uuid } = e.player;
    const player = this.uuids.get(uuid)!
    if (player.name !== name) return;

    this.names.delete(name)
    this.uuids.delete(uuid)

    await this.emit("quit", player)
    await player.emit("quit", undefined)
  }
}