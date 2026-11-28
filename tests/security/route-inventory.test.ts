// GCC - automated route and page permission inventory.
//
// This test reads the source tree instead of trusting a hand-written list. Any
// new route.ts, page.tsx or protected layout must declare its server-side
// controls or appear in the explicit allow-list below with a one-line reason.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());
const API_DIR = join(ROOT, "src", "app", "api");
const APP_DIR = join(ROOT, "src", "app");
const MATRIX_PATH = join(ROOT, "docs", "PERMISSION_MATRIX.md");

type CheckName = "origin" | "writable" | "zod" | "rateLimit" | "role";

type _Exemption = {
  readonly check: CheckName;
  readonly reason: string;
};
void (0 as unknown as _Exemption | undefined);

// Every entry must have a one-line justification. These are the only places
// where a state-changing route may omit a standard control.
const ALLOW_LIST: Record<string, Partial<Record<CheckName, string>>> = {
  "/api/webhooks/resend": {
    origin: "Svix signature verification replaces browser same-origin checks.",
    writable:
      "Provider callbacks must be accepted during platform maintenance to avoid lost deliveries.",
    zod: "Svix verifies the signed envelope before the route reads known fields.",
    rateLimit: "Svix replay protection and signature verification bound duplicates.",
    role: "No session: the caller is authenticated by the provider signature.",
  },
  "/api/unsubscribe": {
    origin: "One-click email links are cross-origin GET/POST navigations.",
    writable: "Unsubscribing must keep working while writes are paused.",
    role: "The signed HMAC token authorises the address, not a session.",
  },
  "/api/csp-report": {
    origin: "Browsers send violation reports cross-origin from any page.",
    writable: "Reporting must stay available during maintenance.",
    role: "Reports are anonymous and intentionally unauthenticated.",
  },
  "/api/health/deep": {
    origin: "GET endpoint; no body.",
    writable: "Read-only dependency checks.",
    zod: "No request body is accepted by this endpoint.",
  },
  "/api/client-error": {
    writable: "Client error reporting must be available during maintenance.",
    role: "Any browser session or visitor may report a boundary error.",
  },
  "/api/test/emails": {
    origin:
      "Test-only endpoint; accessed by Playwright same-origin, but exempted as E2E harness control.",
    writable:
      "Test-only harness endpoint used during E2E; guarded by GCC_E2E + approved demo emulator project.",
    zod: "No request body; endpoint is test-harness only and returns captured emails.",
    rateLimit: "Test-only harness endpoint guarded by GCC_E2E + approved demo emulator project.",
    role: "No user session; endpoint returns 404 unless GCC_E2E harness and capture mode are safely enabled.",
  },
  "/api/test/mock-cloudinary/[...path]": {
    origin: "Same-origin image fetches in E2E; exempted as test-only harness endpoint.",
    writable:
      "Read-only in effect; serves in-memory mock assets only when GCC_E2E harness is safely enabled.",
    zod: "No request body; path params identify mock asset and endpoint is test-harness only.",
    rateLimit: "Test-only harness endpoint guarded by GCC_E2E + approved demo emulator project.",
    role: "No session; endpoint returns 404 unless GCC_E2E harness is safely enabled.",
  },
  "/api/test/seed": {
    origin:
      "Test-only endpoint called by Playwright same-origin; guarded by GCC_E2E harness checks.",
    writable:
      "Test-only emulator seed/reset endpoint; requires GCC_E2E + approved demo emulator project.",
    zod: "No request body; deterministic seed operation is test-harness only.",
    rateLimit: "Test-only harness endpoint guarded by GCC_E2E + approved demo emulator project.",
    role: "No user session; endpoint returns 404 unless GCC_E2E harness is safely enabled.",
  },
  "/api/auth/session": {
    writable: "Session exchange reads state; it must work while writes are paused.",
    role: "This is the endpoint that establishes the session.",
    zod: "No request body: the Firebase ID token is verified by the Admin SDK.",
  },
  "/api/auth/login-attempt": {
    writable: "Pre-auth abuse counters must work while writes are paused.",
    role: "Called before sign-in, so no session exists yet.",
  },
  "/api/auth/turnstile": {
    writable: "Pre-auth bot checks must work while writes are paused.",
    role: "Called before sign-in or password reset, so no session is required.",
  },
  "/api/admin-applications/[id]/withdraw": {
    zod: "No request body: the signed-in owner is taken from the session and the id from the URL.",
  },
  "/api/organiser/logo": {
    zod: "Multipart body is validated by the shared image helper's strict magic-byte and size checks.",
  },
  "/api/profile/avatar": {
    zod: "Multipart body is validated by the shared upload helper's strict magic-byte and size checks.",
  },
  "/api/profile/account": {
    zod: "No request body: freshness is read from the signed session cookie, not client input.",
  },
  "/api/organiser/tournaments/[id]/close-registration": {
    zod: "No request body: only the URL id is used and the stored state is rechecked in the transaction.",
  },
  "/api/organiser/tournaments/[id]/cover": {
    zod: "Multipart body is validated by the shared tournament image upload helper.",
  },
  "/api/organiser/tournaments/[id]/draw/clear": {
    zod: "No request body: the draw is cleared from the stored tournament state.",
  },
  "/api/organiser/tournaments/[id]/draw/confirm": {
    zod: "No request body: confirmation is derived from the stored draw, not client input.",
  },
  "/api/organiser/tournaments/[id]/logo": {
    zod: "Multipart body is validated by the shared tournament image upload helper.",
  },
  "/api/organiser/tournaments/[id]/publish": {
    zod: "No request body: publication rechecks every completion invariant server-side.",
  },
  "/api/organiser/tournaments/[id]/reopen-registration": {
    zod: "No request body: the lifecycle transition is validated against stored state.",
  },
  "/api/organiser/tournaments/[id]/standings/recalculate": {
    zod: "No request body: standings are recomputed from stored results.",
  },
  "/api/super-admin/analytics/refresh": {
    zod: "No request body: metrics are recomputed from Firestore server-side.",
  },
  "/api/super-admin/announcements/[id]/publish": {
    zod: "No request body: the announcement id comes from the URL and state from Firestore.",
  },
  "/api/super-admin/announcements/[id]/unpublish": {
    zod: "No request body: the announcement id comes from the URL and state from Firestore.",
  },
  "/api/super-admin/email/test": {
    zod: "No request body: the test address always comes from the signed-in Super Admin session.",
  },
  "/api/super-admin/stats/recompute": {
    zod: "No request body: stats are recomputed from stored documents.",
  },
  "/api/super-admin/users/[uid]/contact": {
    zod: "No request body: the target uid comes from the URL and the sender from the session.",
  },
};

interface RouteFile {
  readonly path: string;
  readonly apiPath: string;
  readonly source: string;
  readonly code: string;
}

function walk(dir: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      found.push(...walk(full));
    } else if (entry.isFile() && (entry.name === "route.ts" || entry.name.endsWith("page.tsx"))) {
      found.push(full);
    }
  }

  return found;
}

function apiPathFor(file: string): string {
  const relativePath = relative(APP_DIR, file).split(sep).join("/");
  return `/${relativePath.replace(/\/route\.ts$/, "")}`;
}

function stripCommentsAndImports(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/[^\n]*/gm, "")
    .replace(/^import[\s\S]*?;\s*$/gm, "");
}

function readRouteFiles(): RouteFile[] {
  return walk(API_DIR)
    .filter((path) => path.endsWith("route.ts"))
    .map((path) => {
      const source = readFileSync(path, "utf8");
      return { path, apiPath: apiPathFor(path), source, code: stripCommentsAndImports(source) };
    });
}

const SHARED_GUARDS = [
  "guardOrganiserMutation",
  "guardSuperAdminMutation",
  "guardApplicantMutation",
  "handleTournamentImageUpload",
];

function hasAny(code: string, tokens: string[]): boolean {
  return tokens.some((token) => code.includes(token));
}

function requiredRole(
  apiPath: string,
): "public" | "signed-in" | "applicant" | "organiser" | "super-admin" {
  if (apiPath.startsWith("/api/super-admin") || apiPath === "/api/health/deep") {
    return "super-admin";
  }

  if (apiPath.startsWith("/api/organiser")) {
    return "organiser";
  }

  if (apiPath.startsWith("/api/admin-applications")) {
    return "applicant";
  }

  if (
    apiPath.startsWith("/api/profile") ||
    apiPath.startsWith("/api/notifications") ||
    apiPath.startsWith("/api/tournaments")
  ) {
    return "signed-in";
  }

  if (
    apiPath === "/api/auth/session" ||
    apiPath.startsWith("/api/auth/") ||
    apiPath === "/api/health" ||
    apiPath === "/api/client-error" ||
    apiPath === "/api/gamer-tags/check" ||
    apiPath === "/api/players/search" ||
    apiPath === "/api/csp-report" ||
    apiPath === "/api/unsubscribe" ||
    apiPath.startsWith("/api/webhooks/")
  ) {
    return "public";
  }

  return "signed-in";
}

function stateChangingHandlers(code: string): string[] {
  const methods = new Set<string>();
  const patterns = [
    /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\s*\(/g,
    /export\s+const\s+(POST|PUT|PATCH|DELETE)\s*=/g,
  ];

  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      methods.add(match[1] ?? "");
    }
  }

  return [...methods].sort();
}

function isStrictSchemaSource(source: string): boolean {
  return /\.strict\(\)|strictObject\(/.test(source);
}

function hasStrictSchema(route: RouteFile): boolean {
  if (isStrictSchemaSource(route.code)) {
    return true;
  }

  const imports = route.source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'](@\/lib\/[^"']+)["']/g);

  for (const match of imports) {
    const specifier = match[2];

    if (!specifier?.startsWith("@/lib/validation")) {
      continue;
    }

    const candidate = join(ROOT, "src", ...specifier.slice(2).split("/")) + ".ts";

    try {
      if (isStrictSchemaSource(readFileSync(candidate, "utf8"))) {
        return true;
      }
    } catch {
      // A validation module may be a directory with an index.ts; check that.
      try {
        const index = join(ROOT, "src", ...specifier.slice(2).split("/"), "index.ts");

        if (isStrictSchemaSource(readFileSync(index, "utf8"))) {
          return true;
        }
      } catch {
        // The handler may define its schema inline; other checks report that.
      }
    }
  }

  return false;
}

/**
 * Resolve server modules imported by a route so a shared helper can satisfy a
 * security check without repeating the guard token in every thin route file.
 */
function importedModuleSources(source: string, depth = 2): string[] {
  if (depth <= 0) {
    return [];
  }

  const found: string[] = [];

  for (const match of source.matchAll(
    /import\s*(?:type\s*)?(?:[\s\S]*?)\s*from\s*["'](@\/lib\/[^"']+)["']/g,
  )) {
    const specifier = match[1];

    if (!specifier) {
      continue;
    }

    const base = join(ROOT, "src", ...specifier.slice(2).split("/"));

    for (const candidate of [`${base}.ts`, join(base, "index.ts")]) {
      try {
        const moduleSource = readFileSync(candidate, "utf8");
        found.push(moduleSource, ...importedModuleSources(moduleSource, depth - 1));
        break;
      } catch {
        // Try the directory form next.
      }
    }
  }

  return found;
}

function missingChecks(route: RouteFile, method: string): CheckName[] {
  const exemptions = ALLOW_LIST[route.apiPath] ?? {};
  const role = requiredRole(route.apiPath);
  const missing: CheckName[] = [];

  const require = (check: CheckName, present: boolean): void => {
    if (!present && !exemptions[check]) {
      missing.push(check);
    }
  };

  require("origin", hasAny(route.code, ["assertSameOrigin(", ...SHARED_GUARDS]));
  require("writable", hasAny(route.code, ["assertPlatformWritable(", ...SHARED_GUARDS]));
  require("zod", /\.safeParse\(|\.parse\(/.test(route.code) && hasStrictSchema(route));
  require("rateLimit", hasAny(route.code, ["checkRateLimit(", ...SHARED_GUARDS]));

  const roleTokens =
    role === "super-admin"
      ? ["guardSuperAdminMutation", "requireSuperAdmin", "requirePageSuperAdmin"]
      : role === "organiser"
        ? ["guardOrganiserMutation", "handleTournamentImageUpload", 'requireRole("organiser"']
        : role === "applicant"
          ? ["guardApplicantMutation"]
          : role === "signed-in"
            ? ["requireUser(", "requireFreshSession(", "requireRole(", ...SHARED_GUARDS]
            : [];

  require("role", role === "public" || hasAny(route.code, roleTokens));

  // Keep the unused parameter in the signature explicit: the method is part of
  // the failure message and future per-method exemptions.
  void method;

  return missing;
}

describe("API route inventory", () => {
  it("every state-changing handler declares the required server controls", () => {
    const failures: string[] = [];

    for (const route of readRouteFiles()) {
      for (const method of stateChangingHandlers(route.code)) {
        const missing = missingChecks(route, method);

        if (missing.length > 0) {
          failures.push(`${method} ${route.apiPath}: missing ${missing.join(", ")}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it("keep an explicit one-line allow-list for every documented exception", () => {
    for (const [apiPath, checks] of Object.entries(ALLOW_LIST)) {
      expect(apiPath.startsWith("/api/")).toBe(true);

      for (const [check, reason] of Object.entries(checks)) {
        expect(typeof reason).toBe("string");
        expect(reason?.length ?? 0).toBeGreaterThan(20);
        expect(check).toMatch(/^(origin|writable|zod|rateLimit|role)$/);
      }
    }
  });

  it("every API route and method appears in docs/PERMISSION_MATRIX.md", () => {
    const matrix = readFileSync(MATRIX_PATH, "utf8");
    const failures: string[] = [];

    for (const route of readRouteFiles()) {
      if (!matrix.includes(`\`${route.apiPath}\``)) {
        failures.push(`missing route row: ${route.apiPath}`);
      }

      for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE"]) {
        if (
          stateChangingHandlers(route.code).includes(method) ||
          new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`).test(route.code) ||
          new RegExp(`export\\s+const\\s+${method}\\s*=`).test(route.code)
        ) {
          if (
            !new RegExp(
              `\\|\\s*${method}\\s*\\|[^\\n]*\`${route.apiPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\``,
            ).test(matrix)
          ) {
            failures.push(`missing method row: ${method} ${route.apiPath}`);
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });
});

describe("tournament ownership inventory", () => {
  it("every tournament-scoped API route verifies ownership on the server", () => {
    const failures: string[] = [];

    for (const route of readRouteFiles()) {
      if (!route.apiPath.startsWith("/api/organiser/tournaments/[id]")) {
        continue;
      }

      const sources = [route.source, ...importedModuleSources(route.source)];
      const verifiesOwnership = sources.some((source) =>
        stripCommentsAndImports(source).includes("requireTournamentOwnerOrSuperAdmin("),
      );

      if (!verifiesOwnership) {
        failures.push(`${route.apiPath}: missing requireTournamentOwnerOrSuperAdmin`);
      }
    }

    expect(failures).toEqual([]);
  });
});

describe("protected page inventory", () => {
  const groups = [
    { directory: join(APP_DIR, "(dashboard)"), token: "requirePageSignedIn" },
    { directory: join(APP_DIR, "(organiser)"), token: "requirePageRole" },
    { directory: join(APP_DIR, "(super-admin)"), token: "requirePageSuperAdmin" },
  ];

  function ancestorLayouts(file: string): string[] {
    const layouts: string[] = [];
    let current = join(file, "..");

    while (current.startsWith(APP_DIR)) {
      const layout = join(current, "layout.tsx");

      try {
        statSync(layout);
        layouts.push(layout);
      } catch {
        // No layout at this level.
      }

      if (current === APP_DIR) {
        break;
      }

      current = join(current, "..");
    }

    return layouts;
  }

  it("every protected page is covered by a server guard in its layout chain", () => {
    const failures: string[] = [];

    for (const group of groups) {
      for (const file of walk(group.directory).filter((path) => path.endsWith("page.tsx"))) {
        const chain = [file, ...ancestorLayouts(file)]
          .map((path) => stripCommentsAndImports(readFileSync(path, "utf8")))
          .join("\n");
        const hasGuard =
          chain.includes("requirePageSignedIn(") ||
          chain.includes("requirePageRole(") ||
          chain.includes("requirePageSuperAdmin(");

        if (!hasGuard || !chain.includes(`${group.token}(`)) {
          failures.push(`${relative(ROOT, file).split(sep).join("/")}: missing ${group.token}`);
        }

        if (group.directory.includes("(organiser)") && file.includes(`${sep}[id]${sep}`)) {
          if (!chain.includes("getTournamentWorkspace(")) {
            failures.push(
              `${relative(ROOT, file).split(sep).join("/")}: missing tournament ownership guard`,
            );
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
