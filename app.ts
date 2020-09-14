import type { Client } from "./client.ts";
import type { WSConnection } from "./websockets.ts";

import { Connection } from "./connection.ts";

export class App extends Connection<{
  close: [string | undefined]
}>{
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