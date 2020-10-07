import type { WSConnection } from "./websockets/connection.ts";

import { Connection } from "./connection.ts";

export class App extends Connection {
  constructor(
    readonly conn: WSConnection,
  ) {
    super(conn)
  }
}