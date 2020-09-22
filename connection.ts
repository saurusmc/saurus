import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"
import * as UUID from "https://deno.land/std@0.70.0/uuid/v4.ts"

import { WSChannel, WSMessage, WSConnection } from "./websockets.ts";

export interface ConnectionEvents {
  close: [string | undefined]
}

export class Connection<E extends ConnectionEvents = ConnectionEvents> extends EventEmitter<E> {
  readonly uuid = UUID.generate()

  readonly channels = new EventEmitter<{
    [x: string]: [WSChannel, unknown]
  }>()

  constructor(
    readonly conn: WSConnection
  ) {
    super()

    conn.on(["close"], this.onclose.bind(this))
    conn.on(["message"], this.onmessage.bind(this))
  }

  get hello() {
    return {
      uuid: this.uuid
    }
  }

  protected async onclose(reason?: string) {
    await this.emit("close", reason)
  }

  protected async onmessage(msg: WSMessage) {
    if (msg.method === "open") {
      const { channel: id, action, data } = msg;
      if (!action) return;
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