import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"

import { Console } from "./console.ts";
import { Handler, HandlerOptions } from "./handler.ts";

export interface SaurusOptions extends HandlerOptions {

}

export class Saurus extends EventEmitter<{}> {
  readonly console = new Console()
  readonly handler = new Handler(this.options)

  constructor(
    readonly options: SaurusOptions
  ) {
    super()
  }

}