import type { ReactNode } from "react";
import { cx } from "./cx";

// The three kinds of band in docs/DESIGN.md "Colour": yellow is day,
// navy is night, white is the report.
export type BandTone = "sun" | "night" | "paper";

type BandProps = {
  tone: BandTone;
  // The HTML element to render, so a band can be the page's <header>,
  // <footer> or a <section>.
  as?: "div" | "section" | "header" | "footer";
  className?: string;
  children: ReactNode;
  "aria-labelledby"?: string;
};

// A full-width strip of one flat colour. Setting data-band switches the
// band variables in globals.css, so everything inside (text, rules,
// buttons, the focus ring) takes the right colours for this band.
export function Band({
  tone,
  as: Tag = "div",
  className,
  children,
  ...rest
}: BandProps) {
  return (
    <Tag data-band={tone} className={className} {...rest}>
      {children}
    </Tag>
  );
}

type InnerProps = {
  className?: string;
  children: ReactNode;
};

// Keeps content inside the page width with the gutter on both sides
// (20 px on phones, 40 px from 880 px). Bands are full width; their
// content sits in an Inner.
export function Inner({ className, children }: InnerProps) {
  return (
    <div className={cx("mx-auto w-full max-w-page px-gutter", className)}>
      {children}
    </div>
  );
}
