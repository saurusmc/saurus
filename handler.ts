
import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"
import { Random } from "https://deno.land/x/random@v1.1.2/Random.js";

import { Client } from "./client.ts";
import { Server } from "./server.ts";

import type { Player, UUID } from "./player.ts";
import { App } from "./app.ts";

import { HTTPSOptions, WSServer } from "./websockets/server.ts";
import type { WSConnection } from "./websockets/connection.ts";
import type { WSChannel } from "./websockets/channel.ts";

export type Hello = ServerHello | ClientHello | AppHello

export interface ServerHello {
  type: "server" | "proxy",
  platform: string
  password: string
}

export interface ClientHello {
  type: "client",
  code: string
}

export interface AppHello {
  type: "app",
  client: UUID
  token: string
}

export interface HandlerOptions extends HTTPSOptions {
  password: string
}

export class Handler extends EventEmitter<{
  server: [Server]
}> {
  readonly server = new WSServer(this.options)

  readonly clients = new Map<UUID, Client>()
  readonly codes = new Map<string, Player>()

  constructor(
    readonly options: HandlerOptions
  ) {
    super()

    this.server.on(["accept"], this.onaccept.bind(this))
    this.on(["server"], this.onserver.bind(this))
  }

  private async onaccept(conn: WSConnection) {
    conn.on(["message"], console.log)

    const { channel, data: hello } =
      await conn.wait<Hello>("/hello")

    if (hello.type === "server")
      await this.handleserver(channel, hello)

    if (hello.type === "client")
      await this.handleclient(channel, hello)

    if (hello.type === "app")
      await this.handleapp(channel, hello)

    if (hello.type === "proxy")
      await this.handleproxy(channel, hello)
  }

  private async handleserver(channel: WSChannel, hello: ServerHello) {
    const { password, platform } = hello

    if (password !== this.options.password)
      throw new Error("Bad password");

    const server = new Server(channel.conn, platform)
    await channel.close(server.hello)

    await this.emit("server", server)
  }

  private async handleclient(channel: WSChannel, hello: ClientHello) {
    const { code } = hello;

    const player = this.codes.get(code)
    if (!player) throw new Error("Invalid")

    const client = new Client(channel.conn, player)
    this.clients.set(client.uuid, client)
    await channel.close(client.hello)
    await player.emit("connect", client)
  }

  private async handleapp(channel: WSChannel, hello: AppHello) {
    const client = this.clients.get(hello.client)
    if (!client) throw new Error("Invalid")

    const result: boolean =
      await client.request("/authorize", hello.token)

    if (!result) throw new Error("Refused")

    const app = new App(channel.conn, client)
    await channel.close(app.hello)

    await client.emit("app", app)
    console.log("App connected", app.player.name)
  }

  private async handleproxy(channel: WSChannel, hello: ServerHello) {
    const { password, platform } = hello

    if (password !== this.options.password)
      throw new Error("Bad password");

    console.log("Proxy connected", platform)
  }

  gen() {
    while (true) {
      const code = new Random().string(6)
      if (!this.codes.get(code)) return code
    }
  }

  private async onserver(server: Server) {
    server.players.on(["join"], (player) => {
      const code = this.gen()
      this.codes.set(code, player)

      const show = () => player.actionbar(`Code: ${code}`)
      const kick = () => player.kick("Not connected")

      const t = setTimeout(kick, 60 * 1000)
      const i = setInterval(show, 1 * 1000)

      const clean = () => {
        this.codes.delete(code)
        clearTimeout(t)
        clearInterval(i)
      }

      player.once(["connect"], clean)
      player.once(["quit"], clean)
      server.once(["close"], clean)
    })
  }
}