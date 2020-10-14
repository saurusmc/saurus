import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"

import type { Extra } from "./saurus.ts"
import type { Server } from "./server.ts"
import type { App } from "./app.ts"

import type { PlayerChatEvent, PlayerMessageEvent } from "./events.ts"
import type { PlayerInfo } from "./types.ts"

export class Player extends EventEmitter<{
  extras: Extra<PlayerInfo>
  authorize: App
  death: void
  quit: void
  chat: string
}>  {
  tokens = new Set<string>()

  constructor(
    readonly server: Server,
    readonly name: string,
    readonly uuid: string
  ) {
    super()

    const offclose = server.once(["close"],
      this.onserverclose.bind(this))

    const offdeath = server.events.on(["player.death"],
      this.ondeathevent.bind(this))

    const offchat = server.events.on(["player.chat"],
      this.onchatevent.bind(this))

    const offapp = this.on(["authorize"],
      this.onauthorize.bind(this))

    this.once(["quit"], offclose, offdeath, offapp)
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

  private async ondeathevent(e: PlayerMessageEvent) {
    if (e.player.uuid !== this.uuid) return
    await this.emit("death", undefined)
  }

  private async onchatevent(e: PlayerChatEvent) {
    if (e.player.uuid !== this.uuid) return
    await this.emit("chat", e.message)
  }

  private async onauthorize(app: App) {
    const offlist = app.channels.on(["/server/list"], async ({ channel }) => {
      const list = this.server.players.list()
      await channel.close(list)
    })

    this.once(["quit"],
      () => app.conn.close("Quit").catch())

    app.once(["close"], offlist)
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
    duration?: {
      fadein: number,
      stay: number
      fadeout: number
    }
  ) {
    await this.server.request("/player/title", {
      player: this.json,
      title,
      subtitle,
      ...duration
    })
  }
}