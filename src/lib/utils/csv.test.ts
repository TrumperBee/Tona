// GCC — spreadsheet formula-injection regression tests.
import { describe, expect, it } from "vitest";

import { csvCell } from "@/lib/utils/csv";

describe("csvCell", () => {
  it("prefixes every spreadsheet formula trigger with one apostrophe", () => {
    for (const prefix of ["=", "+", "-", "@", "\t"]) {
      expect(csvCell(`${prefix}1+1`)).toBe(`'${prefix}1+1`);
    }

    // CR is a CSV separator, so the whole cell is quoted as well.
    expect(csvCell("\r1+1")).toBe('"\'\r1+1"');
  });

  it("also neutralises a formula hidden behind leading spaces", () => {
    expect(csvCell("  =1+1")).toBe("'  =1+1");
  });

  it("keeps ordinary values unchanged", () => {
    expect(csvCell("Nairobi Storm")).toBe("Nairobi Storm");
    expect(csvCell("2026-11-26T10:00:00.000Z")).toBe("2026-11-26T10:00:00.000Z");
  });

  it("still quotes separators, quotes and newlines after prefixing", () => {
    expect(csvCell('=HYPERLINK("https://evil.example","Go")')).toBe(
      `"'=HYPERLINK(""https://evil.example"",""Go"")"`,
    );
    expect(csvCell("=one\r\ntwo")).toBe(`"'=one\r\ntwo"`);
  });

  it("does not double-prefix an already neutralised cell", () => {
    expect(csvCell("'=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
  });
});
