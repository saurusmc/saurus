import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"

import type { Server, PlayerEvent } from "./server.ts"
import { Player, PlayerInfo } from "./player.ts"

export class Players extends EventEmitter<{
  join: Player
  quit: Player
}>{
  uuids = new Map<string, Player>()
  names = new Map<string, Player>()

  constructor(
    readonly server: Server
  ) {
    super()

    this.listenEvents()

    const offlist = server.channels.on(["/players/list"],
      ({ channel }) => channel.close(this.list()))

    server.once(["close"], offlist)
  }

  private listenEvents() {
    const { server } = this
    const { events } = server

    const offjoin = events.on(["player.join"],
      this.onjoin.bind(this))

    const offquit = events.on(["player.quit"],
      this.onquit.bind(this))

    const offdeath = events.on(["player.death"],
      this.ondeath.bind(this))

    server.once(["close"],
      () => { offjoin(); offquit(); offdeath() })
  }

  list() {
    const infos = new Array<PlayerInfo>()
    for (const player of this.uuids.values())
      infos.push(player.info())
    return infos
  }

  private async onjoin(e: PlayerEvent) {
    const { server } = this;
    const { name, uuid } = e.player;

    const player = new Player(server, name, uuid)
    const cancelled = await this.emit("join", player)

    if (cancelled) {
      await player.kick(cancelled.reason)
    } else {
      this.names.set(name, player)
      this.uuids.set(uuid, player)
    }
  }

  private async onquit(e: PlayerEvent) {
    const { name, uuid } = e.player;

    const player = this.uuids.get(uuid)!!
    if (player.name !== name) return;

    this.names.delete(name)
    this.uuids.delete(uuid)

    await this.emit("quit", player)
    await player.emit("quit", undefined)
  }

  private async ondeath(e: PlayerEvent) {
    const { name, uuid } = e.player;

    const player = this.uuids.get(uuid)!!
    if (player.name !== name) return;

    await player.emit("death", undefined);
  }
}