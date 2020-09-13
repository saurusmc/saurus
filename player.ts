import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"

import { WSChannel } from "./websockets.ts"

import type { Server } from "./server.ts"
import type { Client } from "./client.ts"

export interface TitleDuration {
  fadein: number,
  stay: number
  fadeout: number
}

export class Player extends EventEmitter<{
  connect: [Client]
  death: []
  quit: []
}> {
  client?: Client

  constructor(
    readonly server: Server,
    readonly name: string,
    readonly uuid: string
  ) {
    super()

    this.on(["death"], () => this.actionbar("Haha!"))
  }

  get json() {
    const { name, uuid } = this;
    return { name, uuid }
  }

  async msg(line: string) {
    const { conn } = this.server
    const channel = new WSChannel(conn)

    await channel.write({
      action: "player.message",
      player: this.json,
      message: line
    })
  }

  async actionbar(line: string) {
    const { conn } = this.server
    const channel = new WSChannel(conn)

    await channel.write({
      action: "player.actionbar",
      player: this.json,
      message: line
    })
  }

  async title(
    title: string,
    subtitle: string,
    duration?: TitleDuration
  ) {
    const { conn } = this.server
    const channel = new WSChannel(conn)

    await channel.write({
      action: "player.title",
      player: this.json,
      title: title,
      subtitle: subtitle,
      ...duration
    })
  }
}