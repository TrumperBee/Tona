// GCC - responsive table.
//
// Desktop renders a semantic table. Below the md breakpoint the same data is
// rendered as cards so wide tables never force horizontal page scrolling.
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface TableColumn<T> {
  readonly key: string;
  readonly header: ReactNode;
  readonly render: (row: T) => ReactNode;
  readonly className?: string;
  readonly headerClassName?: string;
  readonly align?: "left" | "center" | "right";
  readonly hideOnMobile?: boolean;
}

export interface TableProps<T> {
  readonly columns: readonly TableColumn<T>[];
  readonly rows: readonly T[];
  readonly getRowKey: (row: T) => string;
  readonly caption?: string;
  readonly emptyState?: ReactNode;
  readonly stickyHeader?: boolean;
  readonly className?: string;
}

const alignStyles = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

export function Table<T>({
  columns,
  rows,
  getRowKey,
  caption,
  emptyState,
  stickyHeader = false,
  className,
}: TableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className={className}>
        {emptyState ?? (
          <p className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-grey-400">
            No records to show.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="hidden overflow-x-auto rounded-xl border border-white/10 md:block">
        <table className="w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead
            className={cn(
              "bg-navy-800/90 text-xs uppercase tracking-eyebrow text-grey-300",
              stickyHeader && "sticky top-0 z-10 backdrop-blur",
            )}
          >
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "border-b border-white/10 px-4 py-3 font-semibold",
                    alignStyles[column.align ?? "left"],
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.03]"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-3.5 text-grey-200",
                      alignStyles[column.align ?? "left"],
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={getRowKey(row)} className="rounded-xl border border-white/10 bg-navy-900/60 p-4">
            <dl className="grid gap-2">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div key={column.key} className="flex items-start justify-between gap-4 text-sm">
                    <dt className="shrink-0 text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                      {column.header}
                    </dt>
                    <dd className="min-w-0 text-right text-grey-200">{column.render(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
