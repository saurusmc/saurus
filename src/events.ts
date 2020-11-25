import { Location, PlayerInfo, TeleportCause, WorldInfo } from "./types.ts";

export interface Event { event: string }

export const minecraftEvents = [
  "player.join",
  "player.quit",
  "player.death",
  "player.respawn",
  // "player.move",
  "player.chat",
  "player.sneak",
  "player.fly",
  "player.sprint",
  "player.teleport",
  "player.command",
  "weather.change",
]

export type MinecraftEvent =
  | PlayerJoinEvent
  | PlayerQuitEvent
  | PlayerDeathEvent
  | PlayerRespawnEvent
  // | PlayerMoveEvent
  | PlayerChatEvent
  | PlayerSneakEvent
  | PlayerFlyEvent
  | PlayerSprintEvent
  | PlayerTeleportEvent
  | PlayerCommandEvent
  | WeatherChangeEvent

export function isMinecraftEvent(e: Event): e is MinecraftEvent {
  return minecraftEvents.includes(e.event)
}

export interface PlayerEvent extends Event { player: PlayerInfo }

export function isPlayerEvent(e: Event): e is PlayerEvent {
  const player = (e as PlayerEvent).player
  if (typeof player !== "object") return false
  if (typeof player.name !== "string") return false
  if (typeof player.uuid !== "string") return false;
  return true;
}

export interface PlayerJoinEvent extends PlayerEvent {
  event: "player.join"
  location: Location
  message: string
}

export interface PlayerQuitEvent extends PlayerEvent {
  event: "player.quit"
  location: Location
  message: string
}

export interface PlayerDeathEvent extends PlayerEvent {
  event: "player.death"
  location: Location
  message: string
}

export interface PlayerRespawnEvent extends PlayerEvent {
  event: "player.respawn"
  location: Location
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

export interface PlayerCommandEvent extends PlayerEvent {
  event: "player.command"
  command: string
}

export interface WeatherChangeEvent {
  event: "weather.change"
  world: WorldInfo
  raining: boolean
}