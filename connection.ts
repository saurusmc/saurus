import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"
import { Random } from "https://deno.land/x/random@v1.1.2/Random.js";
import { timeout as Timeout } from "https://deno.land/x/timeout@1.0/mod.ts"

import { WSChannel, WSCMessage, WSConnection } from "./websockets.ts";

export class Connection<E extends {
  channel: [WSChannel, unknown]
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

  protected async onmessage(msg: WSCMessage) {
    const { channel: id, method, data } = msg;

    if(method === "open"){
      const channel = new WSChannel(this.conn, id)
      await this.emit("channel", channel, data)
    }
  }

  async send(data: unknown) {
    await new WSChannel(this.conn).open(data)
  }

  async request<T = unknown>(data: unknown, timeout = 1000) {
    const channel = new WSChannel(this.conn)
    await channel.open(data)
    const promise = channel.wait<T>()
    return await Timeout(promise, timeout)
  }
}