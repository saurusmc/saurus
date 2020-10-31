import { Connection } from "./connection.ts";

import { WSServerConn } from "../deps/multisocket.ts"

export class App extends Connection {
  constructor(
    readonly ws: WSServerConn,
  ) {
    super(ws)
  }
}