
import { Cancelled, EventEmitter } from "https://deno.land/x/mutevents/mod.ts"
import * as UUID from "https://deno.land/std@0.70.0/uuid/v4.ts"
import { Timeout } from "https://deno.land/x/timeout/mod.ts"
import { Random } from "https://deno.land/x/random@v1.1.2/Random.js";

import { PlayerEvent, Server } from "./server.ts";

import type { Player, PlayerInfo } from "./player.ts";
import { App } from "./app.ts";

import { ListenOptions, WSServer } from "./websockets/server.ts";
import type { WSConnection } from "./websockets/connection.ts";
import type { WSChannel } from "./websockets/channel.ts";

export type Hello = ServerHello | AppHello

export interface ServerHello {
  type: "server" | "proxy",
  platform: string
  password: string
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
  readonly codes = new Map<string, App>()
  readonly tokens = new Map<string, Player>()

  constructor(
    readonly options: ListenOptions,
  ) {
    super()

    const wss = new WSServer(options)
    wss.on(["accept"], this.onaccept.bind(this))

    this.on(["server"], this.onserver.bind(this))
  }

  genCode() {
    while (true) {
      const code = new Random().string(6)
      if (!this.codes.has(code)) return code
    }
  }

  private async onaccept(conn: WSConnection) {
    conn.on(["message"], console.log)

    for await (const hello of conn.listen<Hello>("/hello")) {
      const { channel, data } = hello;

      try {
        if (data.type === "server")
          await this.handleserver(channel, data)
        if (data.type === "app")
          await this.handleapp(channel, data)
      } catch (e) {
        if (e instanceof Error)
          await channel.throw(e.message)
      }
    }
  }

  private async handleserver(channel: WSChannel, hello: ServerHello) {
    const { password, platform } = hello
    const server = new Server(channel.conn, platform, password)
    await channel.close({ uuid: server.uuid })
    await this.emit("server", server)
  }

  private async handleapp(channel: WSChannel, hello: AppHello) {
    const app = new App(channel.conn)

    if (!hello.token) {
      const code = this.genCode()
      this.codes.set(code, app)
      await channel.send(code)

      const close = channel.error(["close"])
      const promise = this.wait(["code"], e => e.code === code)
      const { player } = await Timeout.race([promise, close], 60000)

      const token = UUID.generate()
      this.tokens.set(token, player)

      const welcome: AppWelcome = {
        uuid: app.uuid,
        player: player.json,
        token
      }

      await channel.close(welcome)

      player.once(["quit"], async () => {
        this.tokens.delete(token)
        await app.conn.close("Quit").catch()
      })

      this.listenlist(player, app)
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

      player.once(["quit"],
        () => app.conn.close("Quit").catch())

      this.listenlist(player, app)
      await player.emit("authorize", app)
    }
  }

  private async onserver(server: Server) {
    const off = server.events.on(["player.code"], async (e) => {
      const { player: { uuid }, code } = e
      const player = server.players.uuids.get(uuid)
      if (!player) throw new Cancelled("Invalid player")
      await this.emit("code", { player, code })
    })

    server.once(["close"], off)
  }

  private async listenlist(player: Player, app: App) {
    const offlist = app.channels.on(["/server/list"], async ({ channel }) => {
      const list = player.server.list()
      console.log(list)
      await channel.close(list)
    })

    app.once(["close"], offlist)
  }
}