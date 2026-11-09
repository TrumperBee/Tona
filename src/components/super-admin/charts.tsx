// GCC - dependency-free accessible SVG charts.
//
// These are deliberately small: a vertical bar chart with an SVG <title> per
// bar, visible axis labels and a screen-reader table containing the same data.
// No chart library is involved.
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface BarChartDatum {
  readonly label: string;
  readonly value: number;
}

export interface BarChartProps {
  readonly title: string;
  readonly description?: ReactNode;
  readonly data: readonly BarChartDatum[];
  readonly emptyMessage?: string;
  readonly valueSuffix?: string;
  readonly className?: string;
}

const WIDTH = 720;
const HEIGHT = 260;
const PADDING = { top: 20, right: 12, bottom: 44, left: 12 };

function rounded(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

export function BarChart({
  title,
  description,
  data,
  emptyMessage = "No data yet.",
  valueSuffix = "",
  className,
}: BarChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const hasData = data.length > 0 && total > 0;
  const maxValue = Math.max(1, ...data.map((item) => item.value));
  const usableWidth = WIDTH - PADDING.left - PADDING.right;
  const usableHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const slot = data.length > 0 ? usableWidth / data.length : usableWidth;
  const barWidth = Math.max(2, Math.min(46, slot * 0.68));
  const labelStep = data.length > 16 ? Math.ceil(data.length / 8) : 1;

  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption>
        <h3 className="font-display text-lg font-semibold uppercase tracking-display text-white">
          {title}
        </h3>
        {description ? (
          <div className="mt-1 text-xs leading-5 text-grey-400">{description}</div>
        ) : null}
      </figcaption>

      {hasData ? (
        <>
          <svg
            role="img"
            aria-label={`${title}. ${rounded(total)} total.`}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="mt-4 h-auto w-full overflow-visible"
          >
            <title>{title}</title>
            <desc>
              Bar chart with {data.length} categories and {rounded(total)} total.
            </desc>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={HEIGHT - PADDING.bottom}
              y2={HEIGHT - PADDING.bottom}
              className="stroke-white/15"
              strokeWidth="1"
            />
            {data.map((item, index) => {
              const height =
                item.value === 0 ? 2 : Math.max(2, (item.value / maxValue) * usableHeight);
              const x = PADDING.left + slot * index + (slot - barWidth) / 2;
              const y = HEIGHT - PADDING.bottom - height;

              return (
                <g key={`${item.label}-${index}`}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={height}
                    rx="2"
                    className={cn(
                      item.value === 0 ? "fill-white/15" : "fill-electric-500",
                      "opacity-90",
                    )}
                  >
                    <title>{`${item.label}: ${rounded(item.value)}${valueSuffix}`}</title>
                  </rect>
                  {index % labelStep === 0 ? (
                    <text
                      x={x + barWidth / 2}
                      y={HEIGHT - PADDING.bottom + 16}
                      textAnchor="middle"
                      className="fill-[rgb(148,163,184)] text-[9px]"
                    >
                      {item.label}
                    </text>
                  ) : null}
                  {data.length <= 12 && item.value > 0 ? (
                    <text
                      x={x + barWidth / 2}
                      y={y - 5}
                      textAnchor="middle"
                      className="fill-[rgb(203,213,225)] text-[10px] font-semibold"
                    >
                      {rounded(item.value)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          <table className="sr-only">
            <caption>{title}</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Count</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.label}>
                  <th scope="row">{item.label}</th>
                  <td>
                    {rounded(item.value)}
                    {valueSuffix}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-white/15 bg-navy-900/30 px-4 py-8 text-center text-sm text-grey-400">
          {emptyMessage}
        </p>
      )}
    </figure>
  );
}
