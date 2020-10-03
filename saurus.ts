import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"

import { Console } from "./console.ts";
import { Handler } from "./handler.ts";
import type { ListenOptions } from "./websockets/server.ts";

export class Saurus extends EventEmitter<{}> {
  readonly console = new Console()
  readonly handler = new Handler(this.options)

  constructor(
    readonly options: ListenOptions
  ) {
    super()
  }
}