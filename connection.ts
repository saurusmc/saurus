import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"
import { Random } from "https://deno.land/x/random@v1.1.2/Random.js";

import { WSChannel, WSCMessage, WSConnection } from "./websockets.ts";

export interface ConnectionEvents {
  close: [string | undefined]
}

export class Connection<E extends ConnectionEvents = ConnectionEvents> extends EventEmitter<E> {
  readonly id = new Random().string(10)

  readonly channels = new EventEmitter<{ [x: string]: [WSChannel] }>()

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

    if (method === "open") {
      if (typeof data !== "string") return;
      const reason = data as string
      const channel = new WSChannel(this.conn, id)
      await this.channels.emit(reason, channel)
    }
  }

  async open(reason: string) {
    const channel = new WSChannel(this.conn)
    await channel.open(reason)
    return channel
  }
}