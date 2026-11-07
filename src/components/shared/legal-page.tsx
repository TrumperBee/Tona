// GCC - long-form legal document layout.
//
// Renders a real table of contents with in-page anchors so a policy can be
// scanned and linked without JavaScript.
import type { ReactNode } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils/cn";

export interface LegalSection {
  readonly id: string;
  readonly heading: string;
  readonly body: ReactNode;
}

export interface LegalPageProps {
  readonly title: string;
  readonly eyebrow: string;
  readonly updated: string;
  readonly summary: ReactNode;
  readonly sections: readonly LegalSection[];
  readonly contactNote?: ReactNode;
  readonly className?: string;
}

export function LegalPage({
  title,
  eyebrow,
  updated,
  summary,
  sections,
  contactNote,
  className,
}: LegalPageProps) {
  return (
    <div className={cn("container py-12 sm:py-16", className)}>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={summary}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: title }]}
      />

      <p className="mt-6 text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
        Last updated {updated}
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
        <nav aria-label={`${title} contents`} className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
            On this page
          </p>
          <ol className="mt-4 space-y-2 border-l border-white/10 pl-4">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="rounded text-sm text-grey-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                >
                  <span className="mr-2 tabular-nums text-grey-600">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-3xl">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-heading`}
              className="scroll-mt-24 border-t border-white/10 py-8 first:border-t-0 first:pt-0"
            >
              <h2
                id={`${section.id}-heading`}
                className="font-display text-2xl font-semibold uppercase tracking-display text-white"
              >
                <span className="mr-3 tabular-nums text-gold-400/80">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-grey-300">{section.body}</div>
            </section>
          ))}

          {contactNote ? (
            <div className="mt-4 rounded-lg border border-electric-400/20 bg-electric-500/[0.06] p-5 text-sm leading-7 text-grey-300">
              {contactNote}
            </div>
          ) : null}
        </article>
      </div>
    </div>
  );
}
