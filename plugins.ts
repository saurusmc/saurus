import { EventEmitter } from "https://deno.land/x/mutevents@5.2.2/mod.ts";
import { Player } from "./player.ts";
import { PlayerInfo } from "./types.ts";

export type Promiseable<T> = T | Promise<T>

export interface ToggleableEvents {
  enable: void
  disable: void
}

export interface Toggleable extends EventEmitter<ToggleableEvents> {
  enabled: Promiseable<boolean>
  enable(): Promiseable<void>
  disable(): Promiseable<void>
}

export interface Pinger {
  isPingable(player: Player): Promiseable<boolean>
  ping(player: Player, target: Player): Promiseable<void>
}