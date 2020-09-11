import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"

import { Server, PlayerEvent } from "./server.ts"
import { Player } from "./player.ts"

export class Players extends EventEmitter<{
  join: [Player]
  death: [Player]
  quit: [Player]
}>{
  uuids = new Map<string, Player>()
  names = new Map<string, Player>()

  constructor(
    readonly server: Server
  ) {
    super()

    server.events.on(["player.join"], this.onjoin.bind(this))
    server.events.on(["player.quit"], this.onquit.bind(this))
    server.events.on(["player.death"], this.ondeath.bind(this))
  }

  private async onjoin(e: PlayerEvent) {
    const { server } = this;
    const { name, uuid } = e.player;

    const player = new Player(server, name, uuid)

    this.names.set(name, player)
    this.uuids.set(uuid, player)

    await this.emit("join", player)
  }

  private async onquit(e: PlayerEvent) {
    const { name, uuid } = e.player;

    const player = this.uuids.get(uuid)!!
    if (player.name !== name) return;

    this.names.delete(name)
    this.uuids.delete(uuid)

    await this.emit("quit", player)
    await player.emit("quit")
  }

  private async ondeath(e: PlayerEvent) {
    const { name, uuid } = e.player;

    const player = this.uuids.get(uuid)!!
    if (player.name !== name) return;

    await player.emit("death");
  }
}