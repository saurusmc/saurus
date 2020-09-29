import type { Client } from "./client.ts";
import type { WSConnection } from "./websockets/connection.ts";

import { Connection } from "./connection.ts";

export class App extends Connection {
  constructor(
    readonly conn: WSConnection,
    readonly client: Client
  ) {
    super(conn)

    client.once(["close"], this.onclientclose.bind(this))
  }

  get player() {
    return this.client.player
  }

  private async onclientclose() {
    await this.conn.close()
  }

  get hello() {
    return {
      ...super.hello,
      player: this.player.info
    }
  }
}