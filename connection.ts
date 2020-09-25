import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"
import * as UUID from "https://deno.land/std@0.70.0/uuid/v4.ts"

import type { Close, WSChannel, WSConnection } from "./websockets.ts";

export interface ConnectionEvents {
  close: [e: Close]
}

export class Connection<E extends ConnectionEvents = ConnectionEvents> extends EventEmitter<E> {
  readonly uuid = UUID.generate()

  readonly channels = new EventEmitter<{
    [path: string]: [channel: WSChannel, data: unknown]
  }>()

  constructor(
    readonly conn: WSConnection
  ) {
    super()

    conn.once(["close"], e => this.emit("close", e))
  }

  get hello() {
    return {
      uuid: this.uuid
    }
  }

  // Open a channel
  async open(path: string, data?: unknown) {
    return await this.conn.open(path, data)
  }

  // Shortcut for quick request-response
  async request<T>(path: string, data?: unknown) {
    const channel = await this.open(path, data)
    return await channel.read<T>()
  }
}