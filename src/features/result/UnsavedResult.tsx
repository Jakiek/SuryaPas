"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Caveat, Inner, PosterHeading, SiteHeader } from "@/components";
import { useRouter } from "@/i18n/navigation";
import { postRequest } from "../plan/submit";
import type { LoadedResult } from "./loadResult";
import { inputsFingerprint } from "./ownership";
import { ResultScreen } from "./ResultScreen";
import {
  browserSessionStorage,
  forgetUnsaved,
  homeSummaryOf,
  readUnsaved,
  rememberUnsaved,
  UNSAVED_ID,
  type UnsavedResult as StoredResult,
} from "./unsavedStore";
import { UnsavedProvider } from "./UnsavedContext";
import { toResultView } from "./view";

type Screen =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "ready"; result: LoadedResult };

type RetryState = "idle" | "sending" | "stillUnsaved" | "failed";

/** Everything the result screen needs, built from what the browser kept. */
async function loadedFrom(stored: StoredResult): Promise<LoadedResult> {
  return {
    id: UNSAVED_ID,
    isExample: false,
    view: toResultView(stored.assessment),
    home: homeSummaryOf(stored.request.inputs),
    assumptionSetVersion: stored.assessment.assumptionSetVersion,
    inputsFingerprint: await inputsFingerprint(stored.request.inputs),
  };
}

// The result page for a result the server computed but could not save
// (SPEC 2.5 "Saving fails"). It is read from this tab's session storage, shown
// like any result with a note that the share link is unavailable, and offers
// to retry the save. When the retry works the page moves to the saved link.
export function UnsavedResultPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [stored, setStored] = useState<StoredResult | null>(null);
  const [retry, setRetry] = useState<RetryState>("idle");

  useEffect(() => {
    let cancelled = false;
    const remembered = readUnsaved(browserSessionStorage());
    async function show() {
      if (remembered === null) return setScreen({ kind: "empty" });
      try {
        const result = await loadedFrom(remembered);
        if (cancelled) return;
        setStored(remembered);
        setScreen({ kind: "ready", result });
      } catch {
        // Stored by an older engine whose output the page can no longer read.
        if (!cancelled) setScreen({ kind: "empty" });
      }
    }
    void show();
    return () => {
      cancelled = true;
    };
  }, []);

  const retrySave = useCallback(async () => {
    if (stored === null) return;
    setRetry("sending");
    const outcome = await postRequest(stored.request);
    if (!outcome.ok) return setRetry("failed");
    if (outcome.saved) {
      forgetUnsaved(browserSessionStorage());
      router.replace(`/r/${outcome.id}`);
      return;
    }
    // Still not saved. Keep the newest result, which may be a newer calculation.
    const latest = { request: stored.request, assessment: outcome.assessment };
    rememberUnsaved(browserSessionStorage(), latest);
    setStored(latest);
    setScreen({ kind: "ready", result: await loadedFrom(latest) });
    setRetry("stillUnsaved");
  }, [stored, router]);

  if (screen.kind === "loading") return <Inner className="min-h-[60vh]">{null}</Inner>;
  if (screen.kind === "empty") return <NothingToShow />;

  return (
    <UnsavedProvider notice={<UnsavedNotice state={retry} onRetry={retrySave} />}>
      <ResultScreen {...screen.result} />
    </UnsavedProvider>
  );
}

/** The note above the result: what happened, what still works, and the retry. */
function UnsavedNotice({ state, onRetry }: { state: RetryState; onRetry: () => void }) {
  const t = useTranslations("result.unsaved");
  const sending = state === "sending";
  const message = state === "stillUnsaved" ? t("stillUnsaved") : state === "failed" ? t("retryFailed") : "";

  return (
    <div className="bg-paper">
      <Inner className="py-4">
        <Caveat title={t("title")}>
          <p className="max-w-measure">{t("body")}</p>
          <Button variant="outline" arrow={false} className="mt-3" disabled={sending} onClick={onRetry}>
            {sending ? t("retrying") : t("retry")}
          </Button>
          <p role="status" className="mt-2 min-h-[1.5em] font-bold">
            {message}
          </p>
        </Caveat>
      </Inner>
    </div>
  );
}

/** A visit with nothing kept: a new tab, a closed one, or storage that was blocked. */
function NothingToShow() {
  const t = useTranslations("result.unsaved");
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1">
        <Inner>
          <SiteHeader />
          <div className="max-w-measure pb-10 pt-4">
            <PosterHeading as="h1" size="page">
              {t("emptyTitle")}
            </PosterHeading>
            <p className="mt-4 text-[17px] font-semibold">{t("emptyBody")}</p>
            <Button href="/plan" className="mt-6">
              {t("emptyAction")}
            </Button>
          </div>
        </Inner>
      </main>
    </div>
  );
}
