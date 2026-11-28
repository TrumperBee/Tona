export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertHarnessSafeForRuntime } = await import("@/lib/test-harness");
    assertHarnessSafeForRuntime();
  }
}
