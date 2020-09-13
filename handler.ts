
import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"
import { Random } from "https://deno.land/x/random@v1.1.2/Random.js";

import { Client } from "./client.ts";
import { Server } from "./server.ts";
import { WSServer, HTTPSOptions, WSConnection } from "./websockets.ts";

import type { Player } from "./player.ts";

export class PasswordError extends Error {
  constructor() { super("Bad password") }
}

export interface HelloMessage {
  type: string,
  platform: string
  password: string
}

export interface HandlerOptions extends HTTPSOptions {
  password: string
}

export class Handler extends EventEmitter<{
  server: [Server]
}> {
  readonly server = new WSServer(this.options)
  readonly codes = new Map<string, Player>()

  constructor(
    readonly options: HandlerOptions
  ) {
    super()

    this.server.on(["accept"], this.onaccept.bind(this))
    this.on(["server"], this.onserver.bind(this))
  }

  private async onaccept(conn: WSConnection) {
    const hello = await conn.read() as HelloMessage
    const { type, platform, password } = hello

    if (type === "client") {
      const player = this.codes.get(password)
      if (!player) throw new PasswordError()

      const client = new Client(conn, platform)

      this.codes.delete(password)
      player.client = client

      await conn.write("Connected")
      await player.emit("connect", client)
      console.log("Player connected", player.name)
    }

    if (type === "server") {
      if (password !== this.options.password)
        throw new PasswordError();

      const server = new Server(conn, platform)
      await this.emit("server", server)
    }

    if (type === "proxy") {
      if (password !== this.options.password)
        throw new PasswordError();

      console.log("Proxy connected")
    }
  }

  private async onserver(server: Server) {
    server.players.on(["join"], (player) => {
      let code: string;

      const generate = () => {
        code = new Random().string(4)
        this.codes.set(code, player)
      }

      const show = () => player.actionbar(`Code: ${code}`)
      const i = setInterval(generate, 60 * 1000)
      const j = setInterval(show, 1 * 1000)
      generate()

      const clean = () => {
        clearInterval(i)
        clearInterval(j)
      }

      player.once(["connect"], clean)
      player.once(["quit"], clean)
      server.once(["close"], clean)
    })
  }
}