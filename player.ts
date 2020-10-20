import { EventEmitter } from "mutevents"

import type { Server } from "./server.ts"
import type { App } from "./app.ts"

import type { PlayerChatEvent, PlayerMessageEvent, PlayerSneakEvent, PlayerFlyEvent } from "./events.ts"
import type { Extra, Location, PlayerInfo, UUID } from "./types.ts"

export type TeleportCause =
  | "command"
  | "plugin"
  | "unknown"
  | "nether-portal"
  | "end-portal"
  | "end-gateway"
  | "ender-pearl"
  | "chorus-fruit"
  | "spectate"

export interface Address {
  hostname: string,
  port: number
}

export class Player extends EventEmitter<{
  authorize: App
  death: void
  quit: void
  chat: string
  sneak: boolean
  fly: boolean
}>  {
  extras = new EventEmitter<{
    [x: string]: Extra<PlayerInfo>
  }>()

  tokens = new Set<string>()

  constructor(
    readonly server: Server,
    readonly name: string,
    readonly uuid: string
  ) {
    super()

    const offClose = server.once(["close"],
      this.onServerClose.bind(this))

    const offDeath = server.events.on(["player.death"],
      this.onDeathEvent.bind(this))

    const offChat = server.events.on(["player.chat"],
      this.onChatEvent.bind(this))

    const offSneak = server.events.on(["player.sneak"],
      this.onSneakEvent.bind(this))

    const offFly = server.events.on(["player.fly"],
      this.onFlyEvent.bind(this))

    const offAuthorize = this.on(["authorize"],
      this.onAutorize.bind(this))

    this.once(["quit"],
      offClose, offDeath, offChat, offSneak,
      offFly, offAuthorize
    )
  }

  get json() {
    const { name, uuid } = this;
    return { name, uuid }
  }

  extra(features: string[]) {
    const info = this.json
    for (const feature of features)
      this.extras.emitSync(feature, info)
    return info
  }

  private async onServerClose() {
    await this.emit("quit", undefined)
  }

  private async onDeathEvent(e: PlayerMessageEvent) {
    if (e.player.uuid !== this.uuid) return
    await this.emit("death", undefined)
  }

  private async onChatEvent(e: PlayerChatEvent) {
    if (e.player.uuid !== this.uuid) return
    await this.emit("chat", e.message)
  }

  private async onSneakEvent(e: PlayerSneakEvent) {
    if (e.player.uuid !== this.uuid) return
    await this.emit("sneak", e.sneaking)
  }

  private async onFlyEvent(e: PlayerFlyEvent) {
    if (e.player.uuid !== this.uuid) return
    await this.emit("fly", e.flying)
  }

  private async onAutorize(app: App) {
    const offList = app.channels.on(["/server/list"], async (msg) => {
      const features = msg.data as string[]
      const list = this.server.players.list(features)
      await msg.channel.close(list)
    })

    const offQuit = this.once(["quit"],
      () => app.close("Quit"))

    app.once(["close"], offList, offQuit)
  }

  private async request<T = unknown>(path: string, data = {}) {
    const request = { player: this.json, ...data }
    return await this.server.request<T>(path, request)
  }

  async kick(reason?: string) {
    await this
      .request("/player/kick", { reason })
  }

  async msg(message: string) {
    await this
      .request("/player/message", { message })
  }

  async actionbar(message: string) {
    await this
      .request("/player/actionbar", { message })
  }

  async title(
    title: string,
    subtitle: string,
    duration?: {
      fadein: number,
      stay: number
      fadeout: number
    }
  ) {
    await this.request("/player/title", {
      title,
      subtitle,
      ...duration
    })
  }

  async getLocation() {
    return await this
      .request<Location>("/player/location")
  }

  async teleportLocation(location: Location, cause?: TeleportCause) {
    await this
      .request("/player/teleport", { location, cause })
  }

  async teleportEntity(entity: UUID, cause?: TeleportCause) {
    await this
      .request("/player/teleport", { entity, cause })
  }

  async teleportPlayer(player: PlayerInfo, cause?: TeleportCause) {
    await this.teleportEntity(player.uuid, cause)
  }

  async getLocale() {
    return await this
      .request<string>("/player/locale")
  }

  async getAddress() {
    return await this
      .request<Address>("/player/address")
  }

  async getTime() {
    return await this
      .request<number>("/player/time")
  }

  async setTime(time: number) {
    await this
      .request("/player/time", { time })
  }

  async getDisplayName() {
    return await this
      .request<string>("/player/displayName")
  }

  async setDisplayName(displayName: string) {
    await this
      .request("/player/displayName", { displayName })
  }

  async getHealth() {
    return await this
      .request<number>("/player/health")
  }

  async setHealth(health: number) {
    await this
      .request("/player/health", { health })
  }

  async isFlying() {
    return await this
      .request<boolean>("/player/flying")
  }

  async setFlying(flying: boolean) {
    await this
      .request("/player/flying", { flying })
  }

  async isSneaking() {
    return await this
      .request<boolean>("/player/sneaking")
  }

  async setSneaking(sneaking: boolean) {
    await this
      .request("/player/sneaking", { sneaking })
  }
}