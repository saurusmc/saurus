import { EventEmitter } from "mutevents/mod.ts"
import * as UUID from "std/uuid/v4.ts"

import type { ConnectionCloseError, WSConnection, } from "./websockets/connection.ts"

export interface ConnectionEvents {
  close: ConnectionCloseError
}

export class Connection<T extends ConnectionEvents = ConnectionEvents> extends EventEmitter<T> {
  readonly uuid = UUID.generate()

  constructor(
    readonly conn: WSConnection
  ) {
    super()

    conn.once(["close"], this.reemit("close"))
  }

  get paths() {
    return this.conn.paths
  }

  async close(reason?: string) {
    await this.conn.close(reason);
  }

  async open(path: string, data?: unknown) {
    return await this.conn.open(path, data)
  }

  async request<T>(path: string, data?: unknown) {
    return await this.conn.request<T>(path, data)
  }
}