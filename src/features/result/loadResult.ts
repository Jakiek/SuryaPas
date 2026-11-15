// Reads the result behind a /r/<id> link, on the server.
import "server-only";
import type { Assessment, EngineInputs } from "../../engine";
import { getStore } from "../../lib/store/server";
import { assessExampleHouse, EXAMPLE_ID, EXAMPLE_INPUTS, EXAMPLE_PLACE } from "./exampleHouse";
import { inputsFingerprint } from "./ownership";
import { toResultView, type HomeSummary, type ResultView } from "./view";

/** Everything the result screen receives. Holds no location: the page never shows the pin. */
export interface LoadedResult {
  id: string;
  isExample: boolean;
  view: ResultView;
  home: HomeSummary;
  /** SPEC 4.2: a saved result is shown with the version it was made with, never the current one. */
  assumptionSetVersion: string;
  /** A one-way digest of the inputs, so the browser that made the result can recognise it (see ownership.ts). */
  inputsFingerprint: string;
}

function homeSummary(inputs: EngineInputs, place?: string): HomeSummary {
  return {
    billing: inputs.electricity.billing,
    connectedVa: inputs.electricity.connectedVa,
    subsidised: inputs.electricity.subsidised,
    monthlySpendRp: inputs.electricity.monthlySpendRp,
    roofAreaM2: inputs.roof.areaM2,
    ...(place ? { place } : {}),
  };
}

async function loaded(
  id: string,
  assessment: Assessment,
  inputs: EngineInputs,
  version: string,
  place?: string,
): Promise<LoadedResult> {
  return {
    id,
    isExample: id === EXAMPLE_ID,
    view: toResultView(assessment),
    home: homeSummary(inputs, place),
    assumptionSetVersion: version,
    inputsFingerprint: await inputsFingerprint(inputs),
  };
}

/** The saved result, the example, or null when no result has this id. */
export async function loadResult(id: string): Promise<LoadedResult | null> {
  if (id === EXAMPLE_ID) {
    const assessment = await assessExampleHouse();
    return loaded(id, assessment, EXAMPLE_INPUTS, assessment.assumptionSetVersion, EXAMPLE_PLACE);
  }

  const saved = await getStore().getAssessment(id);
  if (saved === null) return null;
  // The store holds the engine's output exactly as it was returned (SPEC 4.2).
  const assessment = saved.result as unknown as Assessment;
  const inputs = saved.inputs as unknown as EngineInputs;
  return loaded(id, assessment, inputs, saved.assumptionSetVersion);
}
