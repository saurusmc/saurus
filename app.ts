import type { WSConnection } from "./websockets/connection.ts";

import { Connection } from "./connection.ts";

export class App extends Connection {
  constructor(
    readonly conn: WSConnection,
  ) {
    super(conn)

    conn.channels.on(["/players/list"], async ({ channel }) => {
      // await channel.close(this.server.players.list())
    })
  }
}