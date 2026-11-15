import { describe, expect, it } from "vitest";
import { ASSUMPTIONS_V1 } from "./assumptions";
import { batteryCostRp } from "./money";
import { ENGINE_VERSION, assess, recommend } from "./assess";
import { HOURS_PER_YEAR } from "./calendar";
import type { Candidate, EngineInputs, SunSeries } from "./types";

// The made-up sun and example house of src/engine/energy/index.test.ts.
// Sun: a smooth arc from 06:00 to 18:00 peaking at 800 W/m², every day.
const SUN: SunSeries = {
  source: "live",
  ghiWm2: Array.from({ length: HOURS_PER_YEAR }, (_, hour) => {
    const hourOfDay = hour % 24;
    return hourOfDay >= 6 && hourOfDay < 18 ? 800 * Math.sin((Math.PI * (hourOfDay + 0.5 - 6)) / 12) : 0;
  }),
};

// Yogyakarta, 2,200 VA, Rp650,000 a month, someone home with the air conditioning on.
// The roof holds 48 × 0.65 ÷ 2.6 = 12 panels.
const HOUSE: EngineInputs = {
  location: { latitude: -7.8, longitude: 110.4 },
  roof: { areaM2: 48, usableFraction: 0.65, facing: "E", slope: "gentle", shade: "none" },
  electricity: { billing: "postpaid", connectedVa: 2200, subsidised: false, monthlySpendRp: [650_000] },
  lifestyle: { homeOnWeekdays: true, daytimeAc: true, workFromHome: false, electricVehicle: false },
};

const NOBODY_HOME = { homeOnWeekdays: false, daytimeAc: false, workFromHome: false, electricVehicle: false };

// A large bill and nobody home in the daytime: 4,400 VA, Rp1,500,000 a month, daytime share 0.30.
const BIG_BILL_EMPTY_DAYTIME: EngineInputs = {
  ...HOUSE,
  electricity: { billing: "postpaid", connectedVa: 4400, subsidised: false, monthlySpendRp: [1_500_000] },
  lifestyle: NOBODY_HOME,
};

const netSavingsBySize = (candidates: Candidate[]) => candidates.map((candidate) => candidate.withoutBattery.money.netSavingsRp);

describe("recommend", () => {
  const candidate = (panels: number, netSavingsRp: number) =>
    ({ panels, withoutBattery: { money: { netSavingsRp } } }) as unknown as Candidate;

  it("picks the highest net savings, not the shortest payback or the largest size", () => {
    expect(recommend([candidate(2, 5), candidate(3, 9), candidate(4, 7)])?.panels).toBe(3);
  });

  it("picks the smaller size on a tie, since it costs less for the same result", () => {
    expect(recommend([candidate(2, 5), candidate(3, 9), candidate(4, 9)])?.panels).toBe(3);
  });

  it("picks the least bad size when nothing pays", () => {
    expect(recommend([candidate(2, -1), candidate(3, -4)])?.panels).toBe(2);
  });

  it("has nothing to recommend without candidates", () => {
    expect(recommend([])).toBeNull();
  });
});

describe("assess", () => {
  const result = assess(HOUSE, SUN, ASSUMPTIONS_V1);

  it("labels the result with the engine and assumption-set versions", () => {
    expect(result.engineVersion).toBe(ENGINE_VERSION);
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result.assumptionSetVersion).toBe("1");
  });

  it("assesses every size the roof holds and reports the minimum charge", () => {
    expect(result.candidates.map((candidate) => candidate.panels)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(result.minimumChargeRp).toBeCloseTo(127_133.6, 6); // 40 × 2.2 × 1,444.70
  });

  it("gives each size its cost and a cumulative series the length of the horizon", () => {
    for (const candidate of result.candidates) {
      const money = candidate.withoutBattery.money;
      expect(money.upfrontCostRp.typical).toBeCloseTo(candidate.kwp * 16_000_000, 4);
      expect(money.cumulativeSavingsRp).toHaveLength(26); // year 0 to year 25
    }
  });

  it("net savings rise and then fall as size grows for a home with low daytime use, and the recommendation sits at the peak", () => {
    // Each added panel costs the same, but once the panels already cover the little daytime use,
    // more of each extra panel's output is surplus worth nothing (SPEC 3.2 step 5), so its savings fall
    // below its cost and the total turns down.
    const big = assess(BIG_BILL_EMPTY_DAYTIME, SUN, ASSUMPTIONS_V1);
    const net = netSavingsBySize(big.candidates);
    const peak = net.indexOf(Math.max(...net));

    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThan(net.length - 1);
    for (let i = 1; i <= peak; i++) expect(net[i]).toBeGreaterThan(net[i - 1]);
    for (let i = peak + 1; i < net.length; i++) expect(net[i]).toBeLessThan(net[i - 1]);
    expect(big.recommendedPanels).toBe(big.candidates[peak].panels);
  });

  it("recommends a larger system when more of the day's use falls in daylight, all else equal", () => {
    const nobodyHome = assess(BIG_BILL_EMPTY_DAYTIME, SUN, ASSUMPTIONS_V1);
    // Someone home with the air conditioning on: daytime share 0.30 + 0.10 + 0.15 = 0.55.
    const homeWithAc = assess(
      { ...BIG_BILL_EMPTY_DAYTIME, lifestyle: { ...NOBODY_HOME, homeOnWeekdays: true, daytimeAc: true } },
      SUN,
      ASSUMPTIONS_V1,
    );
    expect(nobodyHome.daytimeShare.weekday).toBeCloseTo(0.3, 10);
    expect(homeWithAc.daytimeShare.weekday).toBeCloseTo(0.55, 10);
    expect(homeWithAc.recommendedPanels as number).toBeGreaterThan(nobodyHome.recommendedPanels as number);
  });

  it("reports the battery variant's cost and payback separately from the variant without", () => {
    const withBattery = result.candidates.filter((candidate) => candidate.withBattery !== null);
    expect(withBattery.length).toBeGreaterThan(0);

    for (const candidate of withBattery) {
      const battery = candidate.withBattery!;
      const without = candidate.withoutBattery.money;
      // The battery adds its fixed part plus its per-kWh part at every cost level.
      const added = batteryCostRp(battery.batteryKwh, ASSUMPTIONS_V1); // 14.35m + kWh × 3.6m
      expect(battery.money.upfrontCostRp.low - without.upfrontCostRp.low).toBeCloseTo(added, 4);
      expect(battery.money.upfrontCostRp.typical - without.upfrontCostRp.typical).toBeCloseTo(added, 4);
      expect(battery.money.upfrontCostRp.high - without.upfrontCostRp.high).toBeCloseTo(added, 4);
      // Its own cumulative series, worked out from its own savings and cost.
      expect(battery.money.cumulativeSavingsRp).not.toEqual(without.cumulativeSavingsRp);
      // More solar used at home, so savings at least as large.
      expect(battery.money.firstYearSavingsRp).toBeGreaterThanOrEqual(without.firstYearSavingsRp);
    }
    // The two paybacks are separate numbers: for some size they differ.
    const differs = withBattery.some(
      (candidate) => candidate.withBattery!.money.paybackYears.typical !== candidate.withoutBattery.money.paybackYears.typical,
    );
    expect(differs).toBe(true);
  });

  it("says a subsidised 450 VA home does not pay back", () => {
    // Even if every kWh one kWp makes were used at home, it could not repay its typical cost:
    //   yield per kWp  = 365 × 800 ÷ sin(π/24) Wh/m² ÷ 1,000 × 0.78 × 0.99 (gentle, east) = 1,727.5 kWh a year
    //                    (the 12 daylight hours of the arc sum to 800 ÷ sin(π/24) = 6,129 Wh/m² a day)
    //   worth at most  = 1,727.5 × 415 ÷ 0.95 = Rp754,640 in the first year
    //   over 25 years  = 754,640 × (1 − 0.995^25) ÷ 0.005 = 754,640 × 23.556 = Rp17.78m
    //   typical costs  = 16m upfront + 25 × 160,000 upkeep + 2.4m inverter = Rp22.4m per kWp
    // Every cost scales with kWp, so no size pays back at the typical or high cost.
    const subsidised: EngineInputs = {
      ...HOUSE,
      electricity: { billing: "prepaid", connectedVa: 450, subsidised: true, monthlySpendRp: [100_000] },
    };
    const poor = assess(subsidised, SUN, ASSUMPTIONS_V1);
    expect(poor.yearlyYieldPerKwp).toBeCloseTo(((365 * 800) / Math.sin(Math.PI / 24) / 1000) * 0.78 * 0.99, 6);
    expect(poor.minimumChargeRp).toBe(0);
    for (const candidate of poor.candidates) {
      expect(candidate.withoutBattery.money.paybackYears.typical).toBeNull();
      expect(candidate.withoutBattery.money.paybackYears.high).toBeNull();
    }
    expect(poor.flags.doesNotPayBack).toBe(true);
    expect(result.flags.doesNotPayBack).toBe(false);
  });

  it("recommends nothing and says how much roof is needed when the roof is too small", () => {
    // The smallest system is 2 panels × 2.6 m² = 5.2 m², which needs 5.2 ÷ 0.65 = 8 m² of roof.
    const tiny = assess({ ...HOUSE, roof: { ...HOUSE.roof, areaM2: 4 } }, SUN, ASSUMPTIONS_V1);
    expect(tiny.candidates).toEqual([]);
    expect(tiny.recommendedPanels).toBeNull();
    expect(tiny.roofTooSmall?.requiredAreaM2).toBeCloseTo(8, 10);
    expect(tiny.flags.doesNotPayBack).toBe(false);
  });

  it("flags fallback sun data and heavy shade", () => {
    const flagged = assess({ ...HOUSE, roof: { ...HOUSE.roof, shade: "heavy" } }, { ...SUN, source: "fallback" }, ASSUMPTIONS_V1);
    expect(flagged.flags.fallbackSunData).toBe(true);
    expect(flagged.flags.heavyShade).toBe(true);
    expect(result.flags.fallbackSunData).toBe(false);
    expect(result.flags.heavyShade).toBe(false);
  });

  it("returns the same answer every time", () => {
    expect(assess(HOUSE, SUN, ASSUMPTIONS_V1)).toEqual(result);
  });

  it("runs for a full candidate list in under 200 ms, so the panel picker can recompute live", () => {
    // The test measures time; the engine itself reads no clock.
    const start = performance.now();
    const timed = assess(BIG_BILL_EMPTY_DAYTIME, SUN, ASSUMPTIONS_V1);
    const elapsedMs = performance.now() - start;
    console.info(`assess, ${timed.candidates.length} candidates: ${elapsedMs.toFixed(1)} ms`);
    expect(timed.candidates).toHaveLength(11); // 2 to 12 panels, the most the picker shows
    expect(elapsedMs).toBeLessThan(200);
  });
});
