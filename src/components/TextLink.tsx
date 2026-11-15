import type { MouseEventHandler, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cx } from "./cx";

type TextLinkProps = {
  // With href it is a link (in the current language for paths inside
  // the app); without it, a <button> that looks the same.
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  className?: string;
  children: ReactNode;
};

// An underlined bold line of text for the smaller actions: "Kembali",
// "Lihat contoh hasil". The 12 px padding above and below makes the
// touch target taller than 44 px.
const CLASSES =
  "inline-block cursor-pointer py-3 text-left font-bold underline underline-offset-[3px]";

export function TextLink({ href, onClick, className, children }: TextLinkProps) {
  if (href !== undefined) {
    return (
      <Link href={href} onClick={onClick} className={cx(CLASSES, className)}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cx(CLASSES, className)}>
      {children}
    </button>
  );
}
