import { EventEmitter } from "../deps/mutevents.ts"
import * as UUID from "../deps/uuid.ts"

import { CloseError, WSServerConn } from "../deps/multisocket.ts"

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