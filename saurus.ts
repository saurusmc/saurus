import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"

import { Console } from "./console.ts";
import { Handler, HandlerOptions } from "./handler.ts";
import type { Server } from "./server.ts";

export type Extra<T> = T & { [x: string]: any }

export interface SaurusOptions extends HandlerOptions {

}

export class Saurus extends EventEmitter<{
  server: Server
}> {
  readonly console = new Console()
  readonly handler = new Handler(this.options)

  constructor(
    readonly options: SaurusOptions
  ) {
    super()

    this.handler.on(["server"],
      this.reemit("server"))
  }
}