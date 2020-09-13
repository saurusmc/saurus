import type { WSConnection } from "./websockets.ts";

export class Client {
  constructor(
    readonly conn: WSConnection,
    readonly platform: string
  ) { }
}