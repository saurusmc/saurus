import { readLines } from "std/io/bufio.ts";
import { Cancelled, EventEmitter } from "mutevents/mod.ts"

export class Help {
  readonly map = new Map<string, string>()
  constructor(readonly prefix?: string) { }
}

export class Console extends EventEmitter<{
  help: Help
  command: string
}> {
  constructor() {
    super()

    this.on(["command", "after"],
      this.oncommand.bind(this))

    this.on(["help", "after"],
      this.onhelp.bind(this))

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
        if (!cancelled) console.log(`Unknown command. Type "help" for help.`)
      } catch (e: unknown) {
        console.error(e)
      }
    }
  }

  /**
   * Default help handler
   */
  private async onhelp(help: Help) {
    if (!help.prefix) {
      help.map.set("exit", "Exit Saurus")
    }
  }

  /**
   * Default command handler
   * @param command Command
   */
  private async oncommand(command: string) {
    const [label, ...args] = command.split(" ")

    if (label === "exit") {
      Deno.exit()
    }

    if (label === "help") {
      const prefix = args.join(" ")
      const help = new Help(prefix)
      await this.emit("help", help)

      if (!help.map.size) {
        if (!prefix)
          console.log("Couldn't find commands")
        else
          console.log(`Couldn't find commands for "${prefix}"`)
      } else {
        if (!prefix)
          console.log("Available commands:")
        else
          console.log(`Available commands for "${prefix}":`)

        for (const key of help.map.keys())
          console.log(key, "-", help.map.get(key))
      }

      throw new Cancelled("Help")
    }
  }
}