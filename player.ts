import { EventEmitter } from "mutevents"

import type { Server } from "./server.ts"
import type { App } from "./app.ts"

import { PlayerChatEvent, PlayerSneakEvent, PlayerFlyEvent, MinecraftEvent, OtherEvent, isMinecraftEvent, isPlayerEvent, PlayerTeleportEvent, PlayerRespawnEvent, PlayerDeathEvent, PlayerQuitEvent } from "./events.ts"
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
  death: PlayerDeathEvent["message"]
  quit: PlayerQuitEvent["message"] | undefined
  respawn: PlayerRespawnEvent["bed"]
  chat: PlayerChatEvent["message"]
  sneak: PlayerSneakEvent["sneaking"]
  fly: PlayerFlyEvent["flying"]
  teleport: Pick<PlayerTeleportEvent, "from" | "to" | "cause">
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

    const offclose = server.once(["close"],
      this.onserverclose.bind(this))

    const offevent = server.on(["event"],
      this.onevent.bind(this))

    const offauthorize = this.on(["authorize"],
      this.onautorize.bind(this))

    this.once(["quit"],
      offclose, offevent, offauthorize
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

  private async onserverclose() {
    await this.emit("quit", undefined)
  }

  private async onevent(e: MinecraftEvent | OtherEvent) {
    if (!isMinecraftEvent(e)) return;
    if (!isPlayerEvent(e)) return
    if (e.player.uuid !== this.uuid) return

    if (e.event === "player.death")
      await this.emit("death", e.message)
    if (e.event === "player.chat")
      await this.emit("chat", e.message)
    if (e.event === "player.sneak")
      await this.emit("sneak", e.sneaking)
    if (e.event === "player.fly")
      await this.emit("fly", e.flying)
    if (e.event === "player.respawn")
      await this.emit("respawn", e.bed)
    if (e.event === "player.teleport") {
      const { from, to, cause } = e
      await this.emit("teleport", { from, to, cause })
    }

  }

  private async onautorize(app: App) {
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