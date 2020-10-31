
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
import { isMinecraftEvent, PlayerCodeEvent } from "./events.ts";

export type Hello = ServerHello | AppHello

export interface ServerHello {
  type: "server" | "proxy",
  name: string,
  platform: string,
  password: string,
}

export interface AppHello {
  type: "app",
  token?: string
}

export interface AppWelcome {
  uuid: string,
  player: PlayerInfo,
  token: string
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

    if (data.type === "server")
      await this.handleserver(channel, data)
    if (data.type === "app")
      await this.handleapp(channel, data)

    throw new Cancelled("Handler")
  }

  private async handleserver(channel: WSChannel, hello: ServerHello) {
    const { name, password, platform } = hello
    const conn = channel.conn as WSServerConn
    const server = new Server(conn, name, platform, password)
    await channel.close({ uuid: server.uuid })
    await this.emit("server", server)
  }

  private async handleapp(channel: WSChannel, hello: AppHello) {
    const conn = channel.conn as WSServerConn
    const app = new App(conn)

    if (!hello.token) {
      const code = this.genCode()
      this.codes.set(code, app)
      await channel.send(code)

      const emitter = new EventEmitter<{
        code: Player
      }>()

      const off = this.on(["code"], async (e) => {
        if (e.code !== code) return
        await emitter.emit("code", e.player)
        off()
      })

      const promise = emitter.wait(["code"])
      const close = channel.error(["close"])
      const player = await Timeout.race([promise, close], 60000)

      const token = UUID.generate()
      this.tokens.set(token, player)

      player.once(["quit"],
        () => this.tokens.delete(token))

      const welcome: AppWelcome = {
        uuid: app.uuid,
        player: player.json,
        token
      }

      await channel.close(welcome)
      await player.emit("authorize", app)
    } else {
      const player = this.tokens.get(hello.token)
      if (!player) throw new Error("Invalid token")

      const welcome: AppWelcome = {
        uuid: app.uuid,
        player: player.json,
        token: hello.token
      }

      await channel.close(welcome)
      await player.emit("authorize", app)
    }
  }

  private async onserver(server: Server) {
    const off = server.on(["event"], async (e) => {
      if (!isMinecraftEvent(e)) return
      if (e.event !== "player.code") return
      const { player: { uuid }, code } = e
      const player = server.players.uuids.get(uuid)
      if (!player) throw new Cancelled("Invalid player")
      await this.emit("code", { player, code })
    })

    server.once(["close"], off)
  }
}