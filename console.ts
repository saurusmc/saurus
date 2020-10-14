import { readLines } from "https://deno.land/std/io/bufio.ts";
import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"

export class Console extends EventEmitter<{
  command: string
}> {
  constructor() {
    super()

    this.stdin()
  }

  info(...args: unknown[]) {
    console.log("[INFO]", ...args)
  }

  err(...args: unknown[]) {
    console.error("[ERROR]", ...args)
  }

  warning(...args: unknown[]) {
    console.log("[WARN]", ...args)
  }

  private async stdin() {
    for await (const line of readLines(Deno.stdin))
      await this.emit("command", line)
  }
}