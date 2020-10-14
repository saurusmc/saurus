import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"
import { Timeout, TimeoutError } from "https://deno.land/x/timeout/mod.ts"
import { Abort } from "https://deno.land/x/abortable/mod.ts"

import { Players } from "./players.ts";
import { Connection } from "./connection.ts";

import type { WSConnection } from "./websockets/connection.ts";

import type { PlayerChatEvent, PlayerCodeEvent, PlayerMessageEvent, PlayerMoveEvent, PlayerRespawnEvent } from "./events.ts";

export interface EventMessage {
  event: string
  [x: string]: unknown
}

export class Server extends Connection {
  events = new EventEmitter<{
    "player.join": PlayerMessageEvent
    "player.quit": PlayerMessageEvent
    "player.death": PlayerMessageEvent
    "player.respawn": PlayerRespawnEvent
    "player.move": PlayerMoveEvent
    "player.chat": PlayerChatEvent
    "player.code": PlayerCodeEvent
  }>()

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
        const pong = this.conn.wait(["ping"])
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
      const { event, ...e } = data as EventMessage
      await this.events.emit(event as any, e)
    })

    events.once(["close"], off)
  }

  async execute(command: string) {
    return await this.request<boolean>("/execute", command)
  }
}