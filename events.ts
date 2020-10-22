import { TeleportCause } from "./player.ts";
import { Location, PlayerInfo } from "./types.ts";

export const minecraftEvents = [
  "player.join",
  "player.quit",
  "player.death",
  "player.respawn",
  // "player.move",
  "player.chat",
  "player.code",
  "player.sneak",
  "player.fly",
  "player.sprint",
  "player.teleport",
  "weather.change"
]

export type MinecraftEvent =
  | PlayerJoinEvent
  | PlayerQuitEvent
  | PlayerDeathEvent
  | PlayerRespawnEvent
  // | PlayerMoveEvent
  | PlayerChatEvent
  | PlayerCodeEvent
  | PlayerSneakEvent
  | PlayerFlyEvent
  | PlayerSprintEvent
  | PlayerTeleportEvent
  | WeatherChangeEvent

export interface OtherEvent {
  event: string
}

export function isMinecraftEvent(e: OtherEvent): e is MinecraftEvent {
  return minecraftEvents.includes(e.event)
}

export function isPlayerEvent(e: OtherEvent): e is PlayerEvent {
  const player = (e as PlayerEvent).player
  if (typeof player !== "object") return false
  if (typeof player.name !== "string") return false
  if (typeof player.uuid !== "string") return false;
  return true;
}

export interface PlayerEvent {
  event: string,
  player: PlayerInfo
}

export interface PlayerJoinEvent extends PlayerEvent {
  event: "player.join"
  message: string
}

export interface PlayerQuitEvent extends PlayerEvent {
  event: "player.quit"
  message: string
}

export interface PlayerDeathEvent extends PlayerEvent {
  event: "player.death"
  message: string
}

export interface PlayerRespawnEvent extends PlayerEvent {
  event: "player.respawn"
  anchor: boolean
  bed: boolean
}

export interface PlayerMoveEvent extends PlayerEvent {
  event: "player.move"
  from: Location
  to: Location
}

export interface PlayerChatEvent extends PlayerEvent {
  event: "player.chat"
  format: string,
  message: string
}

export interface PlayerCodeEvent extends PlayerEvent {
  event: "player.code"
  code: string
}

export interface PlayerSneakEvent extends PlayerEvent {
  event: "player.sneak"
  sneaking: boolean
}

export interface PlayerFlyEvent extends PlayerEvent {
  event: "player.fly"
  flying: boolean
}

export interface PlayerSprintEvent extends PlayerEvent {
  event: "player.sprint",
  sprinting: boolean
}

export interface PlayerTeleportEvent extends PlayerEvent {
  event: "player.teleport"
  cause: TeleportCause
  from: Location
  to?: Location
}

export interface WeatherChangeEvent {
  event: "weather.change"
  raining: boolean
}