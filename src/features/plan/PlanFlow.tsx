"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Button,
  Caveat,
  Inner,
  PosterHeading,
  Progress,
  TextLink,
} from "@/components";
import { LocationStep } from "@/features/location/LocationStep";
import { RoofStep } from "@/features/roof/RoofStep";
import { useRouter } from "@/i18n/navigation";
import { STEP_COUNT, type PlanDraft, type StepNumber } from "./draft";
import { ElectricityStep } from "./ElectricityStep";
import { LifestyleStep } from "./LifestyleStep";
import { planStore } from "./planStore";
import { submitAssessment } from "./submit";

const STEP_KEYS = ["location", "roof", "electricity", "lifestyle"] as const;

// Nothing to subscribe to: "has the page reached the browser" never changes.
const noSubscription = () => () => {};

// The flow shell (SPEC 2.2 and 5.2). It owns the draft, the stepper, the
// back and next buttons and the submit. The steps own their questions.
export function PlanFlow() {
  const t = useTranslations("plan");
  const locale = useLocale() as "id" | "en";
  const router = useRouter();

  // The draft lives in planStore, which mirrors it to browser storage.
  const draft = useSyncExternalStore(
    planStore.subscribe,
    planStore.getSnapshot,
    planStore.getServerSnapshot,
  );
  // False while the server render is being replaced in the browser. The
  // steps are only built after that, so each one starts from the restored
  // values and not from the empty draft.
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  // What each step last reported about its own validity.
  const [validity, setValidity] = useState<Record<number, boolean>>({});
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "failed">("idle");

  const step = draft.step;
  const stepKey = STEP_KEYS[step - 1];
  const isLastStep = step === STEP_COUNT;
  const currentStepIsValid = validity[step] === true;

  // The shell gives each step the same callback shape; this one remembers
  // the answer for the step it was made for.
  const reportValidity = useCallback(
    (valid: boolean) =>
      setValidity((all) => (all[step] === valid ? all : { ...all, [step]: valid })),
    [step],
  );

  function update(changes: Partial<PlanDraft>) {
    planStore.set({ ...draft, ...changes });
  }

  function goToStep(next: number) {
    update({ step: next as StepNumber });
  }

  async function submit() {
    setSubmitState("sending");
    const result = await submitAssessment(draft, locale);
    if (result.ok) {
      router.push(`/r/${result.id}`);
      return;
    }
    // The draft is untouched, so the user's answers are all still here.
    setSubmitState("failed");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!currentStepIsValid || submitState === "sending") return;
    if (isLastStep) {
      void submit();
    } else {
      goToStep(step + 1);
    }
  }

  // Moving between steps: cross-fade the new step in (DESIGN.md "Motion"),
  // scroll to the top and give the heading the focus, so keyboard and
  // screen-reader users start at the top of the new step.
  const stepRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  // Null until the first browser render, so loading a restored step on a
  // refresh does not count as moving to it.
  const previousStep = useRef<number | null>(null);
  useEffect(() => {
    if (!inBrowser) return;
    if (previousStep.current === null) {
      previousStep.current = step;
      return;
    }
    if (previousStep.current === step) return;
    previousStep.current = step;
    window.scrollTo(0, 0);
    headingRef.current?.focus();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) {
      stepRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    }
  }, [step, inBrowser]);

  // Until then, an empty page of the same height, so nothing jumps.
  if (!inBrowser) return <Inner className="min-h-[60vh]">{null}</Inner>;

  return (
    <Inner className="max-w-[calc(680px+2*var(--gutter))] pt-4">
      <Progress current={step} total={STEP_COUNT} name={t(`steps.${stepKey}.name`)} />

      <div ref={stepRef}>
        <div ref={headingRef} tabIndex={-1}>
          <PosterHeading as="h1" size="page">
            {t(`steps.${stepKey}.heading`)}
          </PosterHeading>
        </div>
        <p className="mt-3 max-w-[30em] text-[17px] font-medium">
          {t(`steps.${stepKey}.intro`)}
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-2">
          {step === 1 && (
            <LocationStep
              value={draft.location}
              onChange={(location) => update({ location })}
              onValidChange={reportValidity}
            />
          )}
          {step === 2 && (
            <RoofStep
              value={draft.roof}
              onChange={(roof) => update({ roof })}
              onValidChange={reportValidity}
            />
          )}
          {step === 3 && (
            <ElectricityStep
              value={draft.electricity}
              onChange={(electricity) => update({ electricity })}
              onValidChange={reportValidity}
            />
          )}
          {step === 4 && (
            <LifestyleStep
              value={draft.lifestyle}
              onChange={(lifestyle) => update({ lifestyle })}
              onValidChange={reportValidity}
            />
          )}

          {/* SPEC 2.6: the privacy line stands above the final submit. */}
          {isLastStep && (
            <p className="mt-8 max-w-[30em] border-fg border-t-heavy pt-4 text-[15px] font-semibold">
              {t("privacy")}
            </p>
          )}

          {/* SPEC 2.5: when saving fails, say so and let the user retry.
              Nothing they typed is lost. */}
          {submitState === "failed" && (
            <div role="alert" className="mt-6">
              <Caveat title={t("submitFailed.title")}>
                <p>{t("submitFailed.body")}</p>
              </Caveat>
            </div>
          )}

          {!currentStepIsValid && (
            <p className="mt-6 text-sm text-soft">{t("nav.incomplete")}</p>
          )}

          {/* On phones the bar sticks to the bottom of the screen; from
              880 px it sits in the page (DESIGN.md "Layout"). */}
          <div className="sticky bottom-0 -mx-gutter mt-7 grid grid-cols-[auto_1fr] items-center gap-[18px] border-fg border-t-heavy bg-paper px-gutter py-3 lg:static lg:mx-0 lg:mb-10 lg:mt-8 lg:px-0 lg:pt-4">
            {step === 1 ? (
              <TextLink href="/">{t("nav.back")}</TextLink>
            ) : (
              <TextLink onClick={() => goToStep(step - 1)}>{t("nav.back")}</TextLink>
            )}
            <Button
              type="submit"
              disabled={!currentStepIsValid || submitState === "sending"}
              className="sm:min-w-[220px] sm:justify-self-end"
            >
              {submitState === "sending"
                ? t("nav.sending")
                : submitState === "failed"
                  ? t("nav.retry")
                  : t(`steps.${stepKey}.next`)}
            </Button>
          </div>
        </form>
      </div>
    </Inner>
  );
}
