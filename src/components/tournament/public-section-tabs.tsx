"use client";

// GCC - public tournament section tabs.
//
// The overview is the existing server-rendered detail body. The Pots tab only
// exists after the draw is confirmed, so a draft draw has no public surface at
// all. Server elements are passed through as ReactNode, never as component
// references.
import type { ReactNode } from "react";

import { Tabs } from "@/components/ui/tabs";

export function PublicSectionTabs({
  pots,
  children,
}: {
  readonly pots: ReactNode | null;
  readonly children: ReactNode;
}) {
  if (!pots) {
    return <>{children}</>;
  }

  return (
    <Tabs
      ariaLabel="Tournament sections"
      listClassName="container"
      panelClassName="pt-0"
      items={[
        { id: "overview", label: "Overview", content: children },
        { id: "pots", label: "Pots", content: pots },
      ]}
    />
  );
}
