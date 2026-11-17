import type { ReactNode } from "react";
import { cx } from "./cx";

export type LedgerRow = {
  label: string;
  // Usually a <Figure>; plain text in a dense ledger.
  value: ReactNode;
};

type LedgerProps = {
  rows: LedgerRow[];
  // Dense rows are shorter and set the value in bold text: the landing
  // comparison. Normal rows leave room for a Figure.
  dense?: boolean;
  className?: string;
};

// Rows of label and figure with a 1 px rule between them: label left,
// figure right (docs/DESIGN.md "Components"). This is what the design
// uses where a dashboard would use a grid of cards.
export function Ledger({ rows, dense = false, className }: LedgerProps) {
  return (
    <dl className={className}>
      {rows.map((row) => (
        <div
          key={row.label}
          className={cx(
            "flex items-baseline justify-between gap-4 border-t border-rule last:border-b",
            dense ? "py-[9px]" : "py-[13px]",
          )}
        >
          <dt className={dense ? undefined : "font-semibold"}>{row.label}</dt>
          <dd
            className={cx(
              "whitespace-nowrap",
              dense && "text-right font-extrabold tabular-nums",
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Headings sit on one top line, so a heading with a detail line under it does not push the others down.
// A column heading is its words, or its words with a plain-case line under
// them (the battery size), which the capitals of the heading would spoil.
export type ComparisonColumn = string | { heading: string; detail: string };

export type ComparisonRow = {
  label: string;
  // One value per column, in the order of `columns`.
  values: string[];
};

type ComparisonLedgerProps = {
  // What the table compares; read by screen readers, not shown.
  caption: string;
  // The headings of the value columns, such as "Tanpa baterai".
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
  className?: string;
};

// The same ledger with more than one figure per row, for the battery
// comparison. A real table, so a screen reader can say which column
// and which row a figure belongs to.
export function ComparisonLedger({
  caption,
  columns,
  rows,
  className,
}: ComparisonLedgerProps) {
  return (
    <table
      className={cx(
        "w-full border-collapse text-[14.5px] tabular-nums sm:text-base",
        className,
      )}
    >
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {/* The corner above the row labels is empty. */}
          <td />
          {columns.map((column) => {
            const { heading, detail } = typeof column === "string" ? { heading: column, detail: null } : column;
            return (
            <th
              key={heading}
              scope="col"
              className="type-label py-3 pl-2 text-right align-top tracking-[0.1em] sm:pl-3"
            >
              {heading}
              {detail !== null && (
                <span className="mt-0.5 block text-[14px] font-medium normal-case tracking-normal">{detail}</span>
              )}
            </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t border-rule last:border-b">
            <th scope="row" className="py-3 text-left font-semibold">
              {row.label}
            </th>
            {row.values.map((value, index) => (
              <td
                key={index}
                className="whitespace-nowrap py-3 pl-2 text-right font-extrabold sm:pl-3"
              >
                {value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
