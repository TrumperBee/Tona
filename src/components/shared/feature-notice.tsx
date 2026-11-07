// GCC - honest "not available yet" composition for protected routes.
//
// Every protected page renders a real heading and a real explanation of what
// will appear here. It never renders mock tables, counts or controls.
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, type BreadcrumbItem } from "@/components/ui/data-display";

export interface FeatureNoticeProps {
  readonly title: string;
  readonly description: ReactNode;
  readonly eyebrow?: string;
  readonly breadcrumbs?: readonly BreadcrumbItem[];
  readonly availabilityTitle: string;
  readonly availabilityDescription: ReactNode;
  readonly icon?: LucideIcon;
  readonly availabilityEyebrow?: string;
  readonly action?: ReactNode;
  readonly secondaryAction?: ReactNode;
  readonly note?: ReactNode;
  readonly className?: string;
}

export function FeatureNotice({
  title,
  description,
  eyebrow,
  breadcrumbs,
  availabilityTitle,
  availabilityDescription,
  icon,
  availabilityEyebrow = "Not available yet",
  action,
  secondaryAction,
  note,
  className,
}: FeatureNoticeProps) {
  return (
    <div className={className}>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
      />

      <EmptyState
        className="mt-8"
        icon={icon}
        eyebrow={availabilityEyebrow}
        title={availabilityTitle}
        description={availabilityDescription}
        action={action}
        secondaryAction={secondaryAction}
      />

      {note ? (
        <p className="mx-auto mt-4 max-w-2xl text-center text-xs leading-5 text-grey-500">{note}</p>
      ) : null}
    </div>
  );
}
