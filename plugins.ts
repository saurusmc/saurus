import { EventEmitter } from "mutevents";

import type { Player } from "./player.ts";

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