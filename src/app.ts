import { Connection, ConnectionEvents } from "./connection.ts";

import { WSServerConn } from "../deps/multisocket.ts"
import { Player } from "./player.ts";

export interface AppEvents extends ConnectionEvents {
  authorize: Player
}

export class App extends Connection<AppEvents> {
  constructor(
    readonly ws: WSServerConn,
  ) {
    super(ws)
  }
}