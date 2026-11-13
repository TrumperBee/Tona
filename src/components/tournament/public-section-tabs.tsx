"use client";

// GCC - public tournament section tabs.
//
// The overview is the existing server-rendered detail body. The Pots tab only
// exists after the draw is confirmed, and the Fixtures/Results tabs only after
// the schedule is published, so neither a draft draw nor a private draft has a
// public surface at all. Server elements are passed through as ReactNode, never
// as component references.
import type { ReactNode } from "react";

import { Tabs } from "@/components/ui/tabs";

export function PublicSectionTabs({
  pots,
  fixtures,
  table,
  results,
  knockout,
  children,
}: {
  readonly pots: ReactNode | null;
  readonly fixtures: ReactNode | null;
  readonly table: ReactNode | null;
  readonly results: ReactNode | null;
  readonly knockout: ReactNode | null;
  readonly children: ReactNode;
}) {
  const items = [{ id: "overview", label: "Overview", content: children }];

  if (pots) {
    items.push({ id: "pots", label: "Pots", content: pots });
  }

  if (fixtures) {
    items.push({ id: "fixtures", label: "Fixtures", content: fixtures });
  }

  if (table) {
    items.push({ id: "table", label: "Table", content: table });
  }

  if (results) {
    items.push({ id: "results", label: "Results", content: results });
  }

  if (knockout) {
    items.push({ id: "knockout", label: "Knockout", content: knockout });
  }

  if (items.length === 1) {
    return <>{children}</>;
  }

  return (
    <Tabs
      ariaLabel="Tournament sections"
      listClassName="container"
      panelClassName="pt-0"
      items={items}
    />
  );
}
