// GCC - honest "not available yet" notice for tournament workspace tools.
//
// The workspace layout above already renders the guard, header, stepper and
// tab bar, so a tool page only explains what it will do and when it opens.
// It never renders mock tables, counts or controls.
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface WorkspaceToolNoticeProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: ReactNode;
  readonly availabilityTitle: string;
  readonly availabilityDescription: ReactNode;
}

export function WorkspaceToolNotice({
  icon: Icon,
  title,
  description,
  availabilityTitle,
  availabilityDescription,
}: WorkspaceToolNoticeProps) {
  return (
    <Card variant="outline">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon aria-hidden="true" className="h-4 w-4 text-electric-300" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-grey-300">{description}</p>

        <div className="rounded-lg border border-white/10 bg-navy-950/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
            Not available yet
          </p>
          <p className="mt-1.5 text-sm font-semibold text-grey-200">{availabilityTitle}</p>
          <p className="mt-1.5 text-sm leading-6 text-grey-400">{availabilityDescription}</p>
        </div>
      </CardContent>
    </Card>
  );
}
