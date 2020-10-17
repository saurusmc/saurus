import { TeleportCause } from "./player.ts";
import { Location, PlayerInfo } from "./types.ts";

export interface PlayerEvent {
  player: PlayerInfo
}

export interface PlayerMessageEvent extends PlayerEvent {
  message: string
}

export interface PlayerRespawnEvent extends PlayerEvent {
  anchor: boolean
  bed: boolean
}

export interface PlayerMoveEvent extends PlayerEvent {
  from: Location
  to: Location
}

export interface PlayerChatEvent extends PlayerEvent {
  format: string,
  message: string
}

export interface PlayerCodeEvent extends PlayerEvent {
  code: string
}

export interface PlayerSneakEvent extends PlayerEvent {
  sneaking: boolean
}

export interface PlayerFlyEvent extends PlayerEvent {
  flying: boolean
}

export interface PlayerSprintEvent extends PlayerEvent {
  sprinting: boolean
}

export interface PlayerTeleportEvent extends PlayerEvent {
  cause: TeleportCause
  from: Location
  to?: Location
}

export interface WeatherChangeEvent {
  raining: boolean
}