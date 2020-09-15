
import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"
import { Random } from "https://deno.land/x/random@v1.1.2/Random.js";
import { timeout } from "https://deno.land/x/timeout@1.0/mod.ts"

import { Client } from "./client.ts";
import { Server } from "./server.ts";
import { WSServer, HTTPSOptions, WSConnection, WSChannel } from "./websockets.ts";

import type { Player } from "./player.ts";
import { App } from "./app.ts";

export class PasswordError extends Error {
  constructor() { super("Bad password") }
}

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
  id: string
  token: string
}

export interface HandlerOptions extends HTTPSOptions {
  password: string
}

export class Handler extends EventEmitter<{
  server: [Server]
}> {
  readonly server = new WSServer(this.options)

  readonly clients = new Map<string, Client>()
  readonly codes = new Map<string, Player>()

  constructor(
    readonly options: HandlerOptions
  ) {
    super()

    this.server.on(["accept"], this.onaccept.bind(this))
    this.on(["server"], this.onserver.bind(this))
  }

  private async onaccept(conn: WSConnection) {
    const hello = await conn.read() as Hello

    if (hello.type === "client") {
      const { code } = hello;

      const player = this.codes.get(code)
      if (!player) throw new Error("Invalid")

      const client = new Client(conn, player)
      this.clients.set(client.id, client)
      await player.emit("connect", client)
      console.log("Client connected", player.name)
    }

    if (hello.type === "app") {
      const { id, token } = hello

      const client = this.clients.get(id)
      if (!client) throw new Error("Invalid")

      const data = { action: "authorize", token }
      const channel = await client.open("authorize")
      await channel.write(token)
      const result = await channel.wait<boolean>()
      if (!result) throw new Error("Refused")

      const app = new App(conn, client)
      await client.emit("app", app)
      console.log("App connected", app.player.name)
    }

    if (hello.type === "server") {
      const { password, platform } = hello

      if (password !== this.options.password)
        throw new PasswordError();

      const server = new Server(conn, platform)
      await this.emit("server", server)
    }

    if (hello.type === "proxy") {
      const { password, platform } = hello

      if (password !== this.options.password)
        throw new PasswordError();

      console.log("Proxy connected", platform)
    }
  }

  private async onserver(server: Server) {
    server.players.on(["join"], (player) => {
      let code: string;

      while (true) {
        code = new Random().string(6)
        if (this.codes.get(code)) continue
        this.codes.set(code, player)
        break;
      }

      const show = () => player.actionbar(`Code: ${code}`)
      const kick = () => player.kick("Not connected")

      const i = setTimeout(kick, 60 * 1000)
      const j = setInterval(show, 1 * 1000)

      const clean = () => {
        this.codes.delete(code)
        clearTimeout(i)
        clearInterval(j)
      }

      player.once(["connect"], clean)
      player.once(["quit"], clean)
      server.once(["close"], clean)
    })
  }
}