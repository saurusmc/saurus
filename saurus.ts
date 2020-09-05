import { readLines } from "https://deno.land/std@0.65.0/io/bufio.ts";
import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"

export class Saurus extends EventEmitter<{
  command: [string]
}> {
  constructor() {
    super()

    this.stdin()
  }

  private async stdin() {
    for await (const line of readLines(Deno.stdin))
      this.emit("command", line)
  }

}