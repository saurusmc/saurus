import type { WSConn } from "./websockets/conn.ts";

import { Connection } from "./connection.ts";
import { WSServerConn } from "./websockets/server.ts";

export class App extends Connection {
  constructor(
    readonly ws: WSServerConn,
  ) {
    super(ws)
  }
}