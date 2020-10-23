export type WSMessage = WSOpenMessage | WSOtherMessage | WSCloseMessage | WSErrorMessage

export class CloseError extends Error {
  constructor(readonly reason?: string) { super(`Closed`) }
}

export interface WSOpenMessage {
  uuid: string
  type: "open"
  path: string
  data: unknown
}

export interface WSOtherMessage {
  uuid: string
  type?: undefined
  data: unknown
}

export interface WSCloseMessage {
  uuid: string,
  type: "close"
  data: unknown
}

export interface WSErrorMessage {
  uuid: string
  type: "error"
  reason?: string
}