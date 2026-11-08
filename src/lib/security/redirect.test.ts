import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/security/redirect";

describe("safeRedirectPath", () => {
  it("accepts same-origin relative paths", () => {
    expect(safeRedirectPath("/")).toBe("/");
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/organiser/tournaments/abc?tab=results#top")).toBe(
      "/organiser/tournaments/abc?tab=results#top",
    );
    expect(safeRedirectPath("  /dashboard  ")).toBe("/dashboard");
  });

  it("normalises dot segments without escaping the origin", () => {
    expect(safeRedirectPath("/foo/../bar")).toBe("/bar");
    expect(safeRedirectPath("/foo/./bar")).toBe("/foo/bar");
  });

  it("rejects missing, empty and absolute values", () => {
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath("")).toBeNull();
    expect(safeRedirectPath("dashboard")).toBeNull();
    expect(safeRedirectPath("https://evil.example")).toBeNull();
    expect(safeRedirectPath("http://evil.example/path")).toBeNull();
    expect(safeRedirectPath("javascript:alert(1)")).toBeNull();
    expect(safeRedirectPath("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects protocol-relative and backslash bypasses", () => {
    expect(safeRedirectPath("//evil.example")).toBeNull();
    expect(safeRedirectPath("///evil.example")).toBeNull();
    expect(safeRedirectPath("\\\\evil.example")).toBeNull();
    expect(safeRedirectPath("/\\evil.example")).toBeNull();
    expect(safeRedirectPath("/%5Cevil.example")).toBeNull();
    expect(safeRedirectPath("/%5c%5cevil.example")).toBeNull();
    expect(safeRedirectPath("/%2F%2Fevil.example")).toBeNull();
    expect(safeRedirectPath("/%2f%2fevil.example")).toBeNull();
  });

  it("rejects dot-segment tricks that normalise to a network path", () => {
    expect(safeRedirectPath("/..//evil.example")).toBeNull();
    expect(safeRedirectPath("/%2e%2e//evil.example")).toBeNull();
    expect(safeRedirectPath("/foo/..//evil.example")).toBeNull();
  });

  it("rejects control characters and encoded CRLF", () => {
    expect(safeRedirectPath("/foo\nbar")).toBeNull();
    expect(safeRedirectPath("/foo\rbar")).toBeNull();
    expect(safeRedirectPath("/foo\tbar")).toBeNull();
    expect(safeRedirectPath("/foo%00bar")).toBeNull();
    expect(safeRedirectPath("/foo%0d%0aLocation:%20https://evil.example")).toBeNull();
  });
});
