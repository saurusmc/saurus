import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"

import type { Server } from "./server.ts"
import type { Client } from "./client.ts"
import type { App } from "./app.ts"

export interface TitleDuration {
  fadein: number,
  stay: number
  fadeout: number
}

export type UUID = string;

export interface PlayerInfo {
  [x: string]: unknown,
  name: string,
  uuid: UUID
}

export class Player extends EventEmitter<{
  connect: [Client]
  info: [PlayerInfo]
  death: []
  quit: []
}> {
  client?: Client

  constructor(
    readonly server: Server,
    readonly name: string,
    readonly uuid: UUID
  ) {
    super()

    server.on(["close"], this.onserverclose.bind(this))

    this.on(["death"], () => this.actionbar("Haha!"))
    this.on(["connect"], this.onconnect.bind(this))
  }

  async info(extras = false) {
    const { name, uuid } = this;
    const info = { name, uuid }

    if (extras)
      await this.emit("info", info)

    return info
  }

  private async onconnect(client: Client) {
    this.client = client;
    client.once(["close"],
      this.onclientclose.bind(this))
    await this.actionbar("Connected")
  }

  private async onserverclose() {
    await this.emit("quit")
  }

  private async onclientclose() {
    delete this.client
    await this.kick("Disconnected")
  }

  async kick(reason?: string) {
    const player = await this.info()
    await this.server.request("/player/kick", {
      player,
      reason
    })
  }

  async msg(message: string) {
    const player = await this.info()
    await this.server.request("/player/message", {
      player,
      message
    })
  }

  async actionbar(message: string) {
    const player = await this.info()
    await this.server.request("/player/actionbar", {
      player,
      message
    })
  }

  async title(
    title: string,
    subtitle: string,
    duration?: TitleDuration
  ) {
    const player = await this.info()
    await this.server.request("/player/title", {
      player,
      title,
      subtitle,
      ...duration
    })
  }
}