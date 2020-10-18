import { EventEmitter } from "mutevents";
import { Abort } from "abortable";
import { Timeout } from "timeout";
import * as UUID from "std/uuid/v4.ts"

import type { WSMessage } from "./message.ts";

import { CloseError, WSConnection } from "./connection.ts";

export class Close { }

export class WSChannel extends EventEmitter<{
  message: unknown
  close: Close | CloseError
}> {
  constructor(
    readonly conn: WSConnection,
    readonly uuid = UUID.generate()
  ) {
    super()

    const offmessage = conn.on(["message"],
      this.onmessage.bind(this))

    conn.once(["close"], this.reemit("close"))
    this.once(["close"], offmessage)
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      try {
        yield await this.read()
      } catch (e: unknown) {
        if (e instanceof Close)
          break;
        else throw e
      }
    }
  }

  /**
   * Promise that resolves if closed normally, or rejects if closed with an error.
   * @returns Close
   * @throws CloseError
   * @example 
   * await channel.waitclose
   * console.log("Channel closed normally")
   */
  waitclose = new Promise<void>((ok, err) => {
    this.wait(["close"]).then((close) =>
      close instanceof Close ? ok() : err(close))
  })

  private async onmessage(msg: WSMessage) {
    if (msg.uuid !== this.uuid) return;

    if (msg.type === undefined) {
      await this.emit("message", msg.data)
    }

    if (msg.type === "close") {
      await this.emit("message", msg.data)
      await this.emit("close", new Close())
    }

    if (msg.type === "error") {
      await this.emit("close", new CloseError(msg.reason))
    }
  }

  /**
   * Open the channel with some data (or not)
   * @param data Data to send
   */
  async open(path: string, data?: unknown) {
    const { conn, uuid } = this
    await conn.send({ uuid, type: "open", path, data })
  }

  /**
   * Close the channel with some data (or not)
   * @param data Datat to send
   */
  async close(data?: unknown) {
    const { conn, uuid } = this;
    await conn.send({ uuid, type: "close", data })
  }

  /**
   * Close the channel with an error
   * @param reason Error reason
   */
  async throw(reason?: string) {
    const { conn, uuid } = this;
    await conn.send({ uuid, type: "error", reason })
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
   * @throw Close | CloseError | TimeoutError
   */
  async read<T = unknown>(delay = 0) {
    const message = this.wait(["message"])
    const close = this.error(["close"])

    if (delay > 0) {
      return await Timeout.race([message, close], delay) as T
    } else {
      return await Abort.race([message, close]) as T
    }
  }
}