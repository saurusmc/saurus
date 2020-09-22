
import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"
import { Random } from "https://deno.land/x/random@v1.1.2/Random.js";

import { Client } from "./client.ts";
import { Server } from "./server.ts";
import { WSServer, HTTPSOptions, WSConnection, WSChannel } from "./websockets.ts";

import type { Player, UUID } from "./player.ts";
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
  uuid: UUID
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
    const hello = new WSChannel(conn, "hello")
    const msg = await hello.read<Hello>()
    console.log(msg)

    if (msg.type === "client") {
      const { code } = msg;

      const player = this.codes.get(code)
      if (!player) throw new Error("Invalid")

      const client = new Client(conn, player)
      this.clients.set(client.uuid, client)
      await hello.write(client.hello)

      await player.emit("connect", client)
      console.log("Client connected", player.name)
    }

    if (msg.type === "app") {
      const { uuid, token } = msg

      const client = this.clients.get(uuid)
      if (!client) throw new Error("Invalid")

      const channel = await client.open("authorize", token)
      const result = await channel.wait<boolean>(1000)
      if (!result) throw new Error("Refused")

      const app = new App(conn, client)
      await hello.write(app.hello)

      await client.emit("app", app)
      console.log("App connected", app.player.name)
    }

    if (msg.type === "server") {
      const { password, platform } = msg

      if (password !== this.options.password)
        throw new PasswordError();

      const server = new Server(conn, platform)
      await hello.write(server.hello)

      await this.emit("server", server)
    }

    if (msg.type === "proxy") {
      const { password, platform } = msg

      if (password !== this.options.password)
        throw new PasswordError();

      console.log("Proxy connected", platform)
    }
  }

  gen() {
    while (true) {
      const code = new Random().string(6)
      if (this.codes.get(code)) continue
      return code
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