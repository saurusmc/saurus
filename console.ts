import { readLines } from "https://deno.land/std/io/bufio.ts";
import { EventEmitter } from "https://deno.land/x/mutevents/mod.ts"

export class Console extends EventEmitter<{
  command: string
}> {
  constructor() {
    super()

    this.on(["command", "after"],
      this.oncommand.bind(this))

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
    for await (const line of readLines(Deno.stdin)) {
      if (!line) continue

      try {
        const cancelled = await this.emit("command", line)
        if (!cancelled) console.log("Couldn't handle this command")
      } catch (e: unknown) {
        console.error(e)
      }
    }
  }

  /**
   * Default command handler
   * @param command Command
   */
  private async oncommand(command: string) {
    if (command === "exit") Deno.exit()
  }
}