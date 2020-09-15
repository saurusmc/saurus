import type { Client } from "./client.ts";
import type { WSChannel, WSConnection } from "./websockets.ts";

import { Connection } from "./connection.ts";

export class App extends Connection {
  constructor(
    readonly conn: WSConnection,
    readonly client: Client
  ) {
    super(conn)
  }

  get player() {
    return this.client.player
  }

  protected async hello() {
    await this.conn.write({
      id: this.id,
      player: this.player.json
    })
  }
}