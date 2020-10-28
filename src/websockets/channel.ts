import { EventEmitter } from "mutevents/mod.ts";
import { Abort } from "abortable/mod.ts";
import { Timeout } from "timeout/mod.ts";

import { WSMessage } from "./types.ts";

import { WSConn } from "./conn.ts";
import { ChannelCloseError, CloseError } from "./errors.ts";

export interface WSChannelEvents {
  close: unknown
  message: unknown
}

export class WSChannel extends EventEmitter<WSChannelEvents> {
  #closed = false

  /**
   * Create a new unopened channel
   * @param conn Connection
   * @param uuid Channel UUID
   */
  constructor(
    readonly conn: WSConn,
    readonly uuid: string
  ) {
    super()

    conn.once(["close"], this.reemit("close"))
    this.once(["close"], () => this.#closed = true)
  }

  get closed() { return this.#closed }

  /**
   * Redirects errors to the remote
   * @param e Error to redirect
   * @throws unknown if not an Error
   */
  async catch(e: unknown) {
    if (e instanceof CloseError)
      return
    else if (e instanceof Error)
      await this.throw(e.message)
    else throw e
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
    if (close instanceof CloseError) throw close
  }

  /**
   * Close the channel with some data (or not)
   * @param data Data to send
   */
  async close(data?: unknown) {
    const { conn, uuid } = this;
    await this.emit("close", undefined)
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
   * Wait for any message.
   * Throws if it's closed with an error or timed out
   * @param delay Timeout delay
   * @returns Some typed data
   * @throw CloseError | TimeoutError
   */
  async read<T = unknown>(delay = 0) {
    const message = this.wait(["message"])
    const close = this.wait(["close"])

    const result = delay > 0
      ? await Timeout.race([message, close], delay)
      : await Abort.race([message, close])

    if (result instanceof CloseError)
      throw result
    return result as T
  }

  /**
   * Wait for a close message.
   * Throws if it's closed with an error, timed out, or if we received a normal message.
   */
  async final<T = unknown>(delay = 0) {
    const close = this.wait(["close"])
    const message = this.error(["message"])
      .catch(() => new Error("Unexpected message"))

    const result = delay > 0
      ? await Timeout.race([message, close], delay)
      : await Abort.race([message, close])

    if (result instanceof CloseError)
      throw result
    return result as T
  }
}