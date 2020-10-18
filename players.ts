import { EventEmitter } from "mutevents"

import type { Server } from "./server.ts"
import { Player } from "./player.ts"
import { PlayerInfo } from "./types.ts"
import { PlayerMessageEvent } from "./events.ts"

export interface PlayersEvents {
  join: Player
  quit: Player
}

export class Players extends EventEmitter<PlayersEvents> {
  uuids = new Map<string, Player>()
  names = new Map<string, Player>()

  constructor(readonly server: Server) {
    super()

    const offjoin = server.events.on(["player.join"],
      this.onjoin.bind(this))

    const offquit = server.events.on(["player.quit"],
      this.onquit.bind(this))

    server.once(["close"], offjoin, offquit)
  }

  async list(extras: string[]) {
    const infos = new Array<PlayerInfo>()
    for (const player of this.uuids.values())
      infos.push(await player.extra(extras))
    return infos
  }

  get(player: PlayerInfo) {
    return this.uuids.get(player.uuid) || this.names.get(player.name)
  }

  async onjoin(e: PlayerMessageEvent) {
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

  async onquit(e: PlayerMessageEvent) {
    const { name, uuid } = e.player;
    const player = this.uuids.get(uuid)!
    if (player.name !== name) return;

    this.names.delete(name)
    this.uuids.delete(uuid)

    await this.emit("quit", player)
    await player.emit("quit", undefined)
  }
}