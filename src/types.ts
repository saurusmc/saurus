export type Extra<T> = T & { [x: string]: unknown }

export type UUID = string

export interface PlayerInfo {
  name: string,
  uuid: string
}

export interface WorldInfo {
  name: string
  uuid: string
}

export interface Location {
  x: number
  y: number
  z: number
  world?: WorldInfo
}

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
