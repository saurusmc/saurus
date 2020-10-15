import { Player } from "./player.ts";
import { PlayerInfo } from "./types.ts";

export type Promiseable<T> = T | Promise<T>

export interface Toggleable {
  enabled: Promiseable<boolean>
  enable(): Promiseable<void>
  disable(): Promiseable<void>
}

export interface Pinger {
  isPingable(player: Player): Promiseable<boolean>
  ping(player: Player, target: Player): Promiseable<void>
}