import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts";
import * as UUID from "https://deno.land/std@0.70.0/uuid/v4.ts"

import type { WSMessage } from "./message.ts";

import { Close, WSConnection } from "./connection.ts";

export class WSChannel extends EventEmitter<{
  message: [data: unknown]
  close: [e: Close]
}> {
  constructor(
    readonly conn: WSConnection,
    readonly uuid = UUID.generate()
  ) {
    super()

    const offmessage = conn.on(["message"],
      this.onmessage.bind(this))

    conn.once(["close"], c => this.emit("close", c))
    this.once(["close"], offmessage)
  }

  async *[Symbol.asyncIterator]() {
    while (true) yield await this.read()
  }

  private async onmessage(msg: WSMessage) {
    if (msg.uuid !== this.uuid) return;

    if (msg.type === undefined) {
      await this.emit("message", msg.data)
    }

    if (msg.type === "close") {
      await this.emit("message", msg.data)
      await this.emit("close", new Close("OK"))
    }

    if (msg.type === "error") {
      await this.emit("close", new Close(msg.reason))
    }
  }

  async open(path: string, data?: unknown) {
    const { conn, uuid } = this
    await conn.send({ uuid, type: "open", path, data })
  }

  async close(data?: unknown) {
    const { conn, uuid } = this;
    await conn.send({ uuid, type: "close", data })
  }

  async error(reason?: string) {
    const { conn, uuid } = this;
    await conn.send({ uuid, type: "error", reason })
  }

  async send(data?: unknown) {
    const { conn, uuid } = this;
    await conn.send({ uuid, data })
  }

  async read<T = unknown>() {
    return await new Promise<T>((ok, err) => {
      const off1 = this.once(["message"],
        (data) => { off2(); ok(data as T) })

      const off2 = this.once(["close"],
        (close) => { off1(); err(close) })
    })
  }
}