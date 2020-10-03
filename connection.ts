import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"
import * as UUID from "https://deno.land/std@0.70.0/uuid/v4.ts"

import type { WSConnection, Close } from "./websockets/connection.ts"
import type { WSChannel } from "./websockets/channel.ts"

export interface ConnectionEvents {
  close: Close
}

export class Connection<E extends ConnectionEvents = ConnectionEvents> extends EventEmitter<E> {
  readonly uuid = UUID.generate()

  constructor(
    readonly conn: WSConnection
  ) {
    super()

    conn.once(["close"], this.reemit("close"))
  }

  get channels() {
    return this.conn.channels
  }

  async open(path: string, data?: unknown) {
    return await this.conn.open(path, data)
  }

  async request<T>(path: string, data?: unknown) {
    return await this.conn.request<T>(path, data)
  }
}