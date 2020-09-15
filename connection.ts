import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"
import { Random } from "https://deno.land/x/random@v1.1.2/Random.js";

import { WSChannel, WSCMessage, WSConnection } from "./websockets.ts";

export interface ConnectionEvents {
  close: [string | undefined]
}

export class Connection<E extends ConnectionEvents = ConnectionEvents> extends EventEmitter<E> {
  readonly id = new Random().string(10)

  readonly channels = new EventEmitter<{ [x: string]: [WSChannel, unknown] }>()

  constructor(
    readonly conn: WSConnection
  ) {
    super()

    conn.listen()

    conn.on(["close"], this.onclose.bind(this))
    conn.on(["message"], this.onmessage.bind(this))
  }

  async hello() {
    const { id } = this;
    await this.conn.write({ id })
  }

  protected async onclose(reason?: string) {
    await this.emit("close", reason)
  }

  protected async onmessage(msg: WSCMessage) {
    if (msg.method === "open") {
      const { channel: id, action, data } = msg;
      const channel = new WSChannel(this.conn, id)
      await this.channels.emit(action, channel, data)
    }
  }

  async open(action: string, data?: unknown) {
    const channel = new WSChannel(this.conn)
    await channel.open(action, data)
    return channel
  }
}