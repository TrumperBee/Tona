// GCC - in-memory email capture for E2E assertions.
//
// Only enabled in the safe E2E harness. No real email is sent.
import "server-only";

export interface CapturedEmail {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly kind?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly capturedAt: string;
}

const captured: CapturedEmail[] = [];

export function captureEmail(message: CapturedEmail): void {
  captured.push(message);
}

export function getCapturedEmails(): readonly CapturedEmail[] {
  return [...captured];
}

export function clearCapturedEmails(): void {
  captured.length = 0;
}
