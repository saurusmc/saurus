import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"

import type { Server } from "./server.ts"
import type { Client } from "./client.ts"
import type { App } from "./app.ts"

export interface TitleDuration {
  fadein: number,
  stay: number
  fadeout: number
}

export class Player extends EventEmitter<{
  connect: [Client]
  app: [App]
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

    server.on(["close"], this.onserverclose.bind(this))

    this.on(["death"], () => this.actionbar("Haha!"))
    this.on(["connect"], this.onconnect.bind(this))
    this.on(["quit"], this.onquit.bind(this))
  }

  get json() {
    const { name, uuid } = this;
    return { name, uuid }
  }

  private async onconnect(client: Client) {
    client.on(["app"], this.onapp.bind(this))
    client.on(["close"], this.onclientclose.bind(this))
    await this.actionbar("Connected")
    this.client = client;
  }

  private async onapp(app: App) {
    await this.emit("app", app)
  }

  private async onserverclose() {
    await this.emit("quit")
  }

  private async onclientclose() {
    await this.kick("Disconnected")
  }

  private async onquit() {
    await this.client?.conn.close()
    delete this.client
  }

  async kick(reason?: string) {
    await this.server.send({
      actionn: "player.kick",
      reason
    })
  }

  async msg(message: string) {
    await this.server.send({
      action: "player.message",
      player: this.json,
      message
    })
  }

  async actionbar(message: string) {
    await this.server.send({
      action: "player.actionbar",
      player: this.json,
      message
    })
  }

  async title(
    title: string,
    subtitle: string,
    duration?: TitleDuration
  ) {
    await this.server.send({
      action: "player.title",
      player: this.json,
      title: title,
      subtitle: subtitle,
      ...duration
    })
  }
}