import { EventEmitter } from "mutevents"
import * as UUID from "std/uuid/v4.ts"

import type { CloseError, WSConnection, } from "./websockets/connection.ts"

export interface ConnectionEvents {
  close: CloseError
}

export class Connection extends EventEmitter<ConnectionEvents> {
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