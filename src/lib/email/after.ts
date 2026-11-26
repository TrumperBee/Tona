// GCC - run non-blocking work after the response.
//
// Next.js `after()` keeps requests fast. Library code also runs in the test
// harness and in scripts where no request scope exists, so a throw falls back
// to a detached promise instead of failing the action.
import "server-only";

import { after } from "next/server";

export function runAfterResponse(task: () => Promise<unknown>): void {
  const wrapped = async (): Promise<void> => {
    try {
      await task();
    } catch {
      // Email and other best-effort work must never surface to the user.
    }
  };

  try {
    after(wrapped);
  } catch {
    void wrapped();
  }
}
