import { Connection } from "./connection.ts";
import { WSConnection } from "./websockets/connection.ts";

export class Proxy extends Connection {
  constructor(
    readonly conn: WSConnection
  ) {
    super(conn)

  }
}