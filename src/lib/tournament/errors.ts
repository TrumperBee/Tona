// GCC - tournament mutation errors.
//
// Domain-level failures carry an HTTP status and optional per-field messages
// so routes can respond honestly without leaking internals.
export class TournamentMutationError extends Error {
  readonly status: number;
  readonly fields: Readonly<Record<string, string>>;

  constructor(message: string, status = 400, fields: Readonly<Record<string, string>> = {}) {
    super(message);
    this.name = "TournamentMutationError";
    this.status = status;
    this.fields = fields;
  }
}
