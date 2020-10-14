import { Location, PlayerInfo } from "./types.ts";

export interface PlayerEvent {
  player: PlayerInfo
  location: Location
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