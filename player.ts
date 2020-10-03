import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"

import type { Server } from "./server.ts"
import type { App } from "./app.ts"

export interface TitleDuration {
  fadein: number,
  stay: number
  fadeout: number
}

export interface PlayerInfo {
  [x: string]: unknown,
  name: string,
  uuid: string
}

export class Player extends EventEmitter<{
  info: PlayerInfo

  death: void
  quit: void

  authorize: App
}> {
  tokens = new Set<string>()

  constructor(
    readonly server: Server,
    readonly name: string,
    readonly uuid: string
  ) {
    super()

    server.on(["close"], this.onserverclose.bind(this))

    this.on(["death"], () => this.actionbar("Haha!"))
  }

  get json() {
    const { name, uuid } = this;
    return { name, uuid }
  }

  info() {
    const info = this.json
    this.emitSync("info", info)
    return info
  }

  private async onserverclose() {
    await this.emit("quit", undefined)
  }

  async kick(reason?: string) {
    await this.server.request("/player/kick", {
      player: this.json,
      reason
    })
  }

  async msg(message: string) {
    await this.server.request("/player/message", {
      player: this.json,
      message
    })
  }

  async actionbar(message: string) {
    await this.server.request("/player/actionbar", {
      player: this.json,
      message
    })
  }

  async title(
    title: string,
    subtitle: string,
    duration?: TitleDuration
  ) {
    await this.server.request("/player/title", {
      player: this.json,
      title,
      subtitle,
      ...duration
    })
  }
}