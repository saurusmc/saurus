import type { Client } from "./client.ts";
import type { WSChannel, WSConnection } from "./websockets.ts";

import { Connection } from "./connection.ts";

export class App extends Connection {
  constructor(
    readonly conn: WSConnection,
    readonly client: Client
  ) {
    super(conn)

    client.on(["close"], this.onclientclose.bind(this))
  }

  get player() {
    return this.client.player
  }

  private async onclientclose() {
    await this.conn.close()
  }

  get hello() {
    return {
      id: this.id,
      player: this.player.json
    }
  }
}