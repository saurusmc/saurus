import { EventEmitter } from "https://deno.land/x/mutevents@3.0/mod.ts"

import { WSConnection, WSChannel } from "./websockets.ts";
import { Players } from "./players.ts";

export interface PlayerEvent {
  player: {
    uuid: string,
    name: string
  }
}

export class Server extends EventEmitter<{
  open: [WSChannel, unknown]
  close: [string | undefined]
}> {
  events = new EventEmitter<{
    "player.join": [PlayerEvent]
    "player.quit": [PlayerEvent]
    "player.death": [PlayerEvent]
  }>()

  players = new Players(this)

  constructor(
    readonly conn: WSConnection,
    readonly platform: string
  ) {
    super()

    const events = this.channel("event")
    events.on(["message"], this.onevent.bind(this))

    conn.on(["message"], this.onmessage.bind(this))
    conn.on(["close"], this.onclose.bind(this))

    conn.listen()
  }

  channel(id?: string) {
    return new WSChannel(this.conn, id)
  }

  private async onclose(reason?: string) {
    console.log(`Closed: ${reason}`)
    await this.emit("close", reason)
  }

  private async onmessage(msg: any) {
    const { channel: id, method, data } = msg;

    if (method === "open") {
      console.log("opened", id)
      const channel = this.channel(id)
      await this.emit("open", channel, data)
    }
  }

  private async onevent(data: unknown) {
    console.log("event", data)
    const { type, ...e } = data as any
    await this.events.emit(type, e)
    return;
  }

  async execute(command: string) {
    const channel = new WSChannel(this.conn)
    channel.write({ action: "execute", command })
    const done = await channel.wait() as boolean;
    return done;
  }

}