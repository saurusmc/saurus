import type { WSChannel, WSConnection } from "./websockets.ts";
import type { Player } from "./player.ts";
import type { App } from "./app.ts";
import { Connection, ConnectionEvents } from "./connection.ts";

export class Client extends Connection<ConnectionEvents & {
  app: [App]
}> {
  constructor(
    readonly conn: WSConnection,
    readonly player: Player,
  ) {
    super(conn)
  }

  protected async hello() {
    await this.conn.write({
      id: this.id,
      player: this.player.json
    })
  }
}