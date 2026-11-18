"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, HeroInput, TextLink } from "@/components";
import { storePendingAddress } from "@/features/location/pendingAddress";
import { emptyDraft, STEP_COUNT } from "@/features/plan/draft";
import { planStore } from "@/features/plan/planStore";
import { useRouter } from "@/i18n/navigation";
import { hasSavedInputs, resumeStep } from "./resume";

// The tool's first input (SPEC 2.1): the address field with its "Hitung"
// button, and the links under it. A visitor whose browser holds a saved plan
// sees "continue where you left off" as the primary action instead.
export function HeroForm() {
  const t = useTranslations("landing");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [address, setAddress] = useState("");
  // The returning visitor chose to begin again with another address.
  const [startedOver, setStartedOver] = useState(false);

  // The saved draft. On the server and on the first browser render this is the
  // empty draft, so the form below is what the first paint holds; a saved
  // draft then replaces it (the same pattern as the plan flow).
  const draft = useSyncExternalStore(planStore.subscribe, planStore.getSnapshot, planStore.getServerSnapshot);
  const returning = hasSavedInputs(draft) && !startedOver;

  // "Start over" removes its own button, which would drop keyboard focus onto
  // the page body. Put it in the address field that takes its place.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (startedOver) formRef.current?.querySelector("input")?.focus();
  }, [startedOver]);

  // "Continue" is a real link to /plan. Before it navigates, the draft is set
  // to the step to resume, which differs from the step it was saved on only
  // when an earlier step is incomplete.
  function continueFlow() {
    const step = resumeStep(draft);
    if (step !== draft.step) planStore.set({ ...draft, step });
  }

  // SPEC 2.1: the address goes to step 1 through session storage, never the
  // URL, so it is not kept in server logs or browser history. An empty field
  // starts step 1 with nothing filled.
  function startWithAddress(event: FormEvent) {
    event.preventDefault();
    // Starting again clears the saved plan, so step 1 does not show the old pin.
    if (startedOver) planStore.set(emptyDraft());
    storePendingAddress(address);
    router.push("/plan");
  }

  if (returning) {
    const progress = tCommon("progress.label", { current: resumeStep(draft), total: STEP_COUNT });
    return (
      <div className="mt-[26px] max-w-[560px]">
        <Button href="/plan" onClick={continueFlow} className="sm:min-w-[320px]">
          {t("continue.button")}
        </Button>
        <p className="mt-3 text-sm font-semibold">{t("continue.note", { progress })}</p>
        <div className="flex flex-wrap gap-x-[26px]">
          <TextLink onClick={() => setStartedOver(true)}>{t("continue.startOver")}</TextLink>
          <TextLink href="/r/example">{t("hero.example")}</TextLink>
        </div>
      </div>
    );
  }

  return (
    // No name on the field: with scripts off, a plain submit goes to /plan
    // and the address is not put in the URL.
    <form ref={formRef} action={`/${locale}/plan`} onSubmit={startWithAddress} className="mt-[26px]">
      <HeroInput
        label={t("hero.label")}
        buttonLabel={t("hero.button")}
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        placeholder={t("hero.placeholder")}
        autoComplete="street-address"
      />
      <ul className="mt-3 flex flex-wrap items-center gap-x-[18px] gap-y-1 text-sm font-semibold">
        <li>{t("hero.free")}</li>
        <li>{t("hero.time")}</li>
        <li>{t("hero.noSignup")}</li>
        <li>
          <TextLink href="/r/example">{t("hero.example")}</TextLink>
        </li>
      </ul>
    </form>
  );
}
