
import { Cancelled, EventEmitter } from "../deps/mutevents.ts"
import * as UUID from "../deps/uuid.ts"
import { Timeout } from "../deps/timeout.ts"

import { Server } from "./server.ts";

import type { Player } from "./player.ts";
import { App } from "./app.ts";

import {
  ListenOptions,
  Message,
  WSChannel,
  WSConn,
  WSServer,
  WSServerConn
} from "../deps/multisocket.ts"

import type { PlayerInfo } from "./types.ts";
import { isMinecraftEvent, isPlayerEvent } from "./events.ts";
import { Abortable } from "https://deno.land/x/abortable@1.4/mod.ts";

export type Hello = ServerHello | AppHello

export interface AppHello {
  type: "app"
}

export interface ServerHello {
  type: "server",
  name: string,
  platform: string,
  password: string,
}

export interface CodeRequest {
  player: Player
  code: string
}

export class Handler extends EventEmitter<{
  code: CodeRequest
  server: Server
}> {
  readonly ws = new WSServer(this.options)
  readonly codes = new Map<string, App>()
  readonly tokens = new Map<string, Player>()

  constructor(
    readonly options: ListenOptions,
  ) {
    super()

    this.ws.on(["accept"],
      this.onaccept.bind(this))

    this.on(["server"],
      this.onserver.bind(this))
  }

  private genCode() {
    while (true) {
      const code = UUID.generate().slice(0, 6)
      if (!this.codes.has(code)) return code
    }
  }

  private async onaccept(conn: WSConn) {
    const { channel, data } = await
      conn.waitpath("/hello") as Message<Hello>

    try {
      if (data.type === "server")
        await this.handleserver(channel, data)
      if (data.type === "app")
        await this.handleapp(channel)
    } catch (e: unknown) {
      await channel.catch(e)
    }

    throw new Cancelled("Handler")
  }

  private async handleserver(channel: WSChannel, hello: ServerHello) {
    const { name, password, platform } = hello
    const conn = channel.conn as WSServerConn
    const server = new Server(conn, name, platform, password)
    await channel.close({ uuid: server.uuid })
    await this.emit("server", server)
  }

  private async handleapp(channel: WSChannel) {
    const app = new App(channel.conn as WSServerConn)

    const code = this.genCode()
    this.codes.set(code, app)

    app.once(["close"], () =>
      this.codes.delete(code))

    const offtoken = app.ws.paths.on(["/connect"], async (msg) => {
      const { channel, data } = msg
      const token = data as string

      const player = this.tokens.get(token)
      if (!player) throw new Error("Invalid token")

      await channel.close(player.json)
      await player.emit("authorize", app)
      await app.emit("authorize", player)
    })

    const offcode = this.on(["code"], async (e) => {
      if (e.code !== code) return
      const player = e.player

      const token = UUID.generate()
      this.tokens.set(token, player)

      player.once(["quit"],
        () => this.tokens.delete(token))

      await channel.close(player.json)
      await player.emit("authorize", app)
      await app.emit("authorize", player)
    })

    app.once(["close"], offcode, offtoken)

    const authorized = app.wait(["authorize"])
    const closed = app.error(["close"])

    await channel.send(code)

    await Timeout.race([authorized, closed], 60000)

    console.log("App connected!")
  }

  private async onserver(server: Server) {
    const off = server.on(["event"], async (e) => {
      if (!isMinecraftEvent(e)) return
      if (!isPlayerEvent(e)) return

      if (e.event !== "player.command") return

      const [label, ...args] = e.command.split(" ")
      if (label !== "authorize") return

      const player = server.players.get(e.player)
      if (!player) throw new Error("Invalid player")

      try {
        const [code] = args
        if (!code) throw new Error("autorize <code>")
        await this.emit("code", { player, code })
      } catch (e: unknown) {
        await player.catch(e)
      }

      throw new Cancelled("Handler")
    })

    server.once(["close"], off)
  }
}