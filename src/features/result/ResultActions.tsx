"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, TextLink } from "@/components";
import { sendEvent } from "@/lib/events";

type ResultActionsProps = {
  id: string;
  /** The browser that made this result: it may go back and change its answers. */
  isOwner: boolean;
  isExample: boolean;
};

type QuoteState = "idle" | "sending" | "sent" | "failed";
type CopyState = "idle" | "copied" | "failed";

// SPEC 2.3 items 8 and 9: get installer quotes (coming soon), copy the share
// link, view assumptions, edit inputs. A visitor who arrived by link sees the
// result read-only, with "plan your own" in place of "edit inputs".
export function ResultActions({ id, isOwner, isExample }: ResultActionsProps) {
  const t = useTranslations("result.actions");
  const [quote, setQuote] = useState<QuoteState>("idle");
  const [copy, setCopy] = useState<CopyState>("idle");

  // One tap records one anonymous event: the button is disabled from the
  // moment it is tapped, and stays so once the event is recorded. The event
  // carries the result id at most (src/lib/events), never the answers.
  async function askForQuotes() {
    if (quote === "sending" || quote === "sent") return;
    setQuote("sending");
    const recorded = await sendEvent("quote_interest", isExample ? undefined : id);
    setQuote(recorded ? "sent" : "failed");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  const quoteMessage = quote === "sent" ? t("quoteThanks") : quote === "failed" ? t("quoteFailed") : "";
  const copyMessage = copy === "failed" ? t("copyFailed") : "";

  return (
    <>
      <div className="mt-[26px] grid gap-2.5 sm:grid-cols-2">
        <Button note={t("soon")} disabled={quote === "sending" || quote === "sent"} onClick={askForQuotes}>
          {quote === "sending" ? t("quoteSending") : t("quote")}
        </Button>
        <Button variant="outline" arrow={false} onClick={copyLink}>
          {copy === "copied" ? t("copied") : t("copy")}
        </Button>
      </div>
      <p role="status" className="mt-2.5 min-h-[1.5em] font-bold">
        {[quoteMessage, copyMessage].filter(Boolean).join(" ")}
      </p>

      {!isOwner && (
        <div className="mt-4 border-t border-rule pt-4">
          <p className="max-w-[32em]">{isExample ? t("exampleNote") : t("shared")}</p>
          <Button href="/plan" className="mt-3">
            {t("planOwn")}
          </Button>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap gap-x-[26px]">
        <TextLink href={`/assumptions?from=${encodeURIComponent(id)}`}>{t("assumptions")}</TextLink>
        {isOwner && <TextLink href="/plan">{t("edit")}</TextLink>}
      </div>
    </>
  );
}
