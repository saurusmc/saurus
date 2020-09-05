import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"

import { Server, ServerEvent } from "./server.ts"

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

    this.on(["join"], this.onjoin.bind(this))
    this.on(["quit"], this.onquit.bind(this))

    server.on(["event"], this.onevent.bind(this))
  }

  private async onevent(event: ServerEvent) {
    const { type, ...data } = event;

    const [first, second] = type.split(".")
    if (first !== "player") return;

    const { name, uuid } = data.player;

    if (second === "join") {
      const player = new Player(this.server, name, uuid)
      player.on(["death"], () => { this.emit("death", player) })
      player.on(["quit"], () => { this.emit("quit", player) })
      this.emit("join", player)
      return;
    }

    const player = this.uuids.get(uuid)!!
    if (player.name !== name) return;

    if (second === "quit") player.emit("quit")
    if (second === "death") player.emit("death")
  }

  private async onjoin(player: Player) {
    const { name, uuid } = player;
    this.names.set(name, player)
    this.uuids.set(uuid, player)
  }

  private async onquit(player: Player) {
    const { name, uuid } = player;
    this.names.delete(name)
    this.uuids.delete(uuid)
  }
}

export class Player extends EventEmitter<{
  death: []
  quit: []
}> {

  constructor(
    readonly server: Server,
    readonly name: string,
    readonly uuid: string
  ) {
    super()

    this.on(["death"], () => this.actionbar("Haha!"))
  }

  async chat(line: string) {
    const { server, uuid } = this;
    server.write("chat", { uuid, line })
  }

  async actionbar(line: string) {
    const { server, uuid } = this;
    server.write("actionbar", { uuid, line })
  }
}