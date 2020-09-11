import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"

import { Server } from "./server.ts"
import { WSChannel } from "./websockets.ts"

export interface TitleDuration {
  fadein: number,
  stay: number
  fadeout: number
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

  async msg(line: string) {
    const { conn } = this.server
    const channel = new WSChannel(conn)

    await channel.write({
      action: "player.message",
      uuid: this.uuid,
      message: line
    })
  }

  async actionbar(line: string) {
    const { conn } = this.server
    const channel = new WSChannel(conn)

    await channel.write({
      action: "player.actionbar",
      uuid: this.uuid,
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
      uuid: this.uuid,
      title: title,
      subtitle: subtitle,
      ...duration
    })
  }
}