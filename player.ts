import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"

import type { Extra } from "./saurus.ts"
import type { Server } from "./server.ts"
import type { App } from "./app.ts"

export interface TitleDuration {
  fadein: number,
  stay: number
  fadeout: number
}

export interface PlayerInfo {
  name: string,
  uuid: string
}

export class ServerPlayer extends EventEmitter<{
  extras: Extra<PlayerInfo>
  authorize: App
  death: void
  quit: void
}>  {
  tokens = new Set<string>()

  constructor(
    readonly server: Server,
    readonly name: string,
    readonly uuid: string
  ) {
    super()

    server.once(["close"], this.onserverclose.bind(this))

    server.events.on(["player.death"], async (e) => {
      if (e.player.uuid !== this.uuid) return
      await this.emit("death", undefined)
    })
  }

  get json() {
    const { name, uuid } = this;
    return { name, uuid }
  }

  extras() {
    const info = this.json
    this.emitSync("extras", info)
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