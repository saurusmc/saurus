import { Timeout, TimeoutError } from "../deps/timeout.ts"

import { Players } from "./players.ts";
import { Connection, ConnectionEvents } from "./connection.ts";

import { Event } from "./events.ts";

import { WSServerConn } from "../deps/multisocket.ts"

export interface ServerEvents extends ConnectionEvents {
  event: Event
}

export class Server extends Connection<ServerEvents> {
  players = new Players(this)

  constructor(
    readonly ws: WSServerConn,
    readonly name: string,
    readonly platform: string,
    readonly password: string,
  ) {
    super(ws)

    this.heartbeat()
    this.listenevents()
  }

  private async heartbeat() {
    try {
      while (true) {
        await Timeout.wait(1000)
        await this.ws.ping()
        const pong = this.ws.wait(["pong"])
        const close = this.ws.error(["close"])
        await Timeout.race([pong, close], 5000)
      }
    } catch (e: unknown) {
      if (e instanceof TimeoutError)
        await this.close("Timed out")
    }
  }

  private async listenevents() {
    const events = await this.open("/events")

    const off = events.on(["message"], async (data) => {
      const e = data as Event
      await this.emit("event", e)
    })

    events.once(["close"], off)
  }

  async execute(command: string) {
    return await this.request<boolean>("/execute", command)
  }
}