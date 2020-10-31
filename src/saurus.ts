import { EventEmitter } from "../deps/mutevents.ts"
import { ListenOptions } from "../deps/multisocket.ts";

import { Console } from "./console.ts";
import { Handler } from "./handler.ts";

import type { Server } from "./server.ts";

export class Saurus extends EventEmitter<{
  server: Server
}> {
  readonly console = new Console()
  readonly handler = new Handler(this.options)

  constructor(
    readonly options: ListenOptions
  ) {
    super()

    this.handler.on(["server"],
      this.reemit("server"))
  }
}