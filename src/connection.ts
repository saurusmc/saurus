import { EventEmitter } from "mutevents/mod.ts"
import * as UUID from "std/uuid/v4.ts"

import type { WSConn, } from "./websockets/conn.ts"
import { CloseError } from "./websockets/errors.ts"
import { WSServerConn } from "./websockets/server.ts"

export interface ConnectionEvents {
  close: CloseError
}

export class Connection<T extends ConnectionEvents = ConnectionEvents> extends EventEmitter<T> {
  readonly uuid = UUID.generate()

  constructor(
    readonly ws: WSServerConn
  ) {
    super()

    ws.once(["close"],
      this.reemit("close"))
  }

  get paths() {
    return this.ws.paths
  }

  async close(reason?: string) {
    await this.ws.close(reason);
  }

  async open(path: string, data?: unknown) {
    return await this.ws.open(path, data)
  }

  async request<T>(path: string, data?: unknown) {
    return await this.ws.request<T>(path, data)
  }
}