// GCC - design-system showcase (development only).
// This is the only route where demo data is allowed.
import { notFound } from "next/navigation";

import { DesignSystemShowcase } from "@/app/design-system/showcase";

export const metadata = {
  title: "Design system",
  description: "Internal GCC component and token reference.",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DesignSystemShowcase />;
}
