import type { WSConnection } from "./websockets.ts";
import type { Player } from "./player.ts";
import type { App } from "./app.ts";
import { Connection, ConnectionEvents } from "./connection.ts";

export interface ClientEvents extends ConnectionEvents {
  app: [App]
}

export class Client extends Connection<ClientEvents> {
  constructor(
    readonly conn: WSConnection,
    readonly player: Player,
  ) {
    super(conn)

    player.once(["quit"], this.onquit.bind(this))
  }

  private async onquit() {
    await this.conn.close()
  }

  get hello() {
    return {
      ...super.hello,
      player: this.player.json
    }
  }
}