import { EventEmitter } from "mutevents";

import type { Player } from "./player.ts";

export type Promiseable<T> = T | Promise<T>

export interface ToggleableEvents {
  enable: void
  disable: void
}

export interface Toggleable extends EventEmitter<ToggleableEvents> {
  enable(): Promiseable<void>
  disable(): Promiseable<void>
}

export interface Pinger {
  get(player: Player): Promiseable<boolean>
  set(player: Player, value: boolean): Promiseable<void>
  clear(player: Player): Promiseable<void>
  ping(player: Player, target: Player): Promiseable<void>
}