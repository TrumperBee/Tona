// GCC - shared user-facing registration error copy.
// Kept free of server imports so the form can show the same messages.

export function formatGamerTagTakenError(message = "That gamer tag is already taken."): string {
  return `${message} Choose another before continuing.`;
}
