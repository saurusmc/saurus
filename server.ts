import { EventEmitter } from "mutevents"
import { Timeout, TimeoutError } from "timeout"
import { Abort } from "abortable"

import { Players } from "./players.ts";
import { Connection, ConnectionEvents } from "./connection.ts";

import type { WSConnection } from "./websockets/connection.ts";
import { minecraftEvents, MinecraftEvent, Event } from "./events.ts";

export interface ServerEvents extends ConnectionEvents {
  event: Event
}

export class Server extends Connection<ServerEvents> {

  players = new Players(this)

  constructor(
    readonly conn: WSConnection,
    readonly name: string,
    readonly platform: string,
    readonly password: string,
  ) {
    super(conn)

    this.heartbeat()
    this.listenevents()
  }

  private async heartbeat() {
    try {
      while (true) {
        await Timeout.wait(1000)
        await this.conn.socket.ping()
        const pong = this.conn.wait(["pong"])
        const close = this.conn.error(["close"])
        const timeout = Timeout.error(5000)
        await Abort.race([pong, close, timeout])
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