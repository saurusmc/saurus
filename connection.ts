import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"
import { Random } from "https://deno.land/x/random@v1.1.2/Random.js";

import { WSChannel, WSConnection } from "./websockets.ts";

export class Connection<E extends {
  close: [string | undefined]
}> extends EventEmitter<E> {
  readonly id = new Random().string(10)

  constructor(
    readonly conn: WSConnection
  ) {
    super()

    this.hello()
    conn.listen()

    conn.on(["close"], this.onclose.bind(this))
    conn.on(["message"], this.onmessage.bind(this))
  }

  protected async hello() {
    const { id } = this;
    await this.conn.write({ id })
  }

  protected async onclose(reason?: string) {
    await this.emit("close", reason)
  }

  protected async onmessage(msg: any) {

  }

  async send(data: unknown) {
    const channel = new WSChannel(this.conn)
    await channel.write(data)
  }

  async request<T = unknown>(data: unknown) {
    const channel = new WSChannel(this.conn)
    await channel.write(data)
    return await channel.wait<T>()
  }
}