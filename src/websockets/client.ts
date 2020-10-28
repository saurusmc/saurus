import { Abort } from "abortable/mod.ts";
import { WSConn } from "./conn.ts";
import { ConnectionCloseError } from "./errors.ts";
import { WSMessage } from "./types.ts";

export class WSClientConn extends WSConn {

  constructor(
    readonly socket: WebSocket
  ) {
    super()

    this.socket.onopen = this.onopen.bind(this)
    this.socket.onerror = this.onerror.bind(this)
    this.socket.onclose = this.onclose.bind(this)
    this.socket.onmessage = this.onmessage.bind(this)
  }

  get closed() {
    return this.socket.readyState === WebSocket.CLOSED
  }

  private async onopen(e: Event) {
    await this.emit("open", undefined)
  }

  private async onclose(e: CloseEvent) {
    await this.emit("close",
      new ConnectionCloseError(e.reason))
  }

  private async onerror(e: Event) {
    await this.emit("error", new Error())
  }

  private async onmessage(e: MessageEvent) {
    const data = JSON.parse(e.data)
    await this.emit("message", data)
  }

  private async _waitready() {
    const open = this.wait(["open"])
    const error = this.error(["error"])
    await Abort.race([open, error])
  }

  async send(msg: WSMessage) {
    const text = JSON.stringify(msg)
    this.socket.send(text)
  }

  async close(reason?: string) {
    if (this.closed) return
    this.socket.close(1000, reason)
  }
}