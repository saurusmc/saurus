import { EventEmitter } from "mutevents/mod.ts";
import { Abort } from "abortable/mod.ts";
import { Timeout } from "timeout/mod.ts";


import { CloseError, WSMessage } from "./message.ts";

import { WSConnection } from "./connection.ts";

export class ChannelCloseError extends CloseError { }

export class WSChannel extends EventEmitter<{
  close: CloseError
  message: unknown
}> {
  constructor(
    readonly conn: WSConnection,
    readonly uuid: string
  ) {
    super()

    conn.once(["close"], this.reemit("close"))
  }

  /**
   * Promise that resolves if closed normally, or rejects if closed with an error.
   * @throws CloseError
   * @example 
   * await channel.waitclose
   * console.log("Channel closed normally")
   */
  readonly waitclose = this._waitclose()
    .catch(() => undefined)

  private async _waitclose() {
    const close = await this.wait(["close"])
    if (close.reason !== "OK") throw close
  }

  async catch(e: unknown) {
    if (e instanceof CloseError)
      return
    else if (e instanceof Error)
      await this.throw(e.message)
  }

  /**
   * Close the channel with some data (or not)
   * @param data Datat to send
   */
  async close(data?: unknown) {
    const { conn, uuid } = this;
    await this.emit("close",
      new ChannelCloseError("OK"))
    const message: WSMessage =
      { uuid, type: "close", data }
    await conn.send(message)
  }

  /**
   * Close the channel with an error
   * @param reason Error reason
   */
  async throw(reason?: string) {
    const { conn, uuid } = this;
    await this.emit("close",
      new ChannelCloseError(reason))
    const message: WSMessage =
      { uuid, type: "error", reason }
    await conn.send(message)
  }

  /**
   * Send some data
   * @param data Data to send
   */
  async send(data?: unknown) {
    const { conn, uuid } = this;
    await conn.send({ uuid, data })
  }

  /**
   * Wait for a message.
   * Throws if it's closed or timed out
   * @param delay Timeout delay
   * @returns Some typed data
   * @throw CloseError | TimeoutError
   */
  async read<T = unknown>(delay = 0) {
    const message = this.wait(["message"])
    const close = this.error(["close"])

    if (delay > 0) {
      const result =
        await Timeout.race([message, close], delay)
      return result as T
    } else {
      const result =
        await Abort.race([message, close])
      return result as T
    }
  }
}