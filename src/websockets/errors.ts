export class CloseError extends Error {
  constructor(readonly reason?: string) { super(`Closed`) }
}

export class ConnectionCloseError extends CloseError { }
export class ChannelCloseError extends CloseError { }
