import { describe, expect, it } from "vitest";
import enPlan from "../../../messages/en/plan.json";
import idPlan from "../../../messages/id/plan.json";
import {
  assessmentRequestSchema,
  electricitySchema,
  engineInputsSchema,
  lifestyleSchema,
  maxMonthlySpendRp,
  messageKeysByField,
  roofSchema,
} from "./inputs";

const validInputs = {
  location: { latitude: -7.78, longitude: 110.37 },
  roof: { areaM2: 48, usableFraction: 0.65, facing: "E", slope: "gentle", shade: "none" },
  electricity: {
    billing: "postpaid",
    connectedVa: 2200,
    subsidised: false,
    monthlySpendRp: [650000],
  },
  lifestyle: {
    homeOnWeekdays: true,
    daytimeAc: false,
    workFromHome: true,
    electricVehicle: false,
  },
};

describe("engine input schemas", () => {
  it("accept a complete, valid set of inputs", () => {
    expect(engineInputsSchema.safeParse(validInputs).success).toBe(true);
  });

  it("accept the request the flow sends", () => {
    const body = { inputs: validInputs, overrides: {}, locale: "id" };
    expect(assessmentRequestSchema.safeParse(body).success).toBe(true);
  });

  it("reject an empty spend field and name the fix", () => {
    const result = electricitySchema.safeParse({
      ...validInputs.electricity,
      monthlySpendRp: [null],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(messageKeysByField(result.error)["monthlySpendRp.0"]).toBe("errors.billRequired");
    }
  });

  it("accept one to twelve months and refuse thirteen", () => {
    const withMonths = (count: number) => ({
      ...validInputs.electricity,
      monthlySpendRp: Array.from({ length: count }, () => 500000),
    });
    expect(electricitySchema.safeParse(withMonths(1)).success).toBe(true);
    expect(electricitySchema.safeParse(withMonths(12)).success).toBe(true);
    expect(electricitySchema.safeParse(withMonths(13)).success).toBe(false);
    expect(electricitySchema.safeParse(withMonths(0)).success).toBe(false);
  });

  it("refuse a spend of zero or with cents", () => {
    for (const bad of [0, -5, 650000.5]) {
      const result = electricitySchema.safeParse({
        ...validInputs.electricity,
        monthlySpendRp: [bad],
      });
      expect(result.success, `spend ${bad}`).toBe(false);
    }
  });

  it("give zero its own message", () => {
    const result = electricitySchema.safeParse({ ...validInputs.electricity, monthlySpendRp: [0] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(messageKeysByField(result.error)["monthlySpendRp.0"]).toBe("errors.billZero");
    }
  });

  it("accept only connected-power pairs the select offers", () => {
    const withPair = (connectedVa: number, subsidised: boolean) =>
      electricitySchema.safeParse({
        ...validInputs.electricity,
        connectedVa,
        subsidised,
        monthlySpendRp: [100000], // under every class's ceiling
      }).success;
    expect(withPair(900, true)).toBe(true);
    expect(withPair(900, false)).toBe(true);
    expect(withPair(450, true)).toBe(true);
    expect(withPair(2200, true)).toBe(false); // no subsidised 2,200 VA exists
    expect(withPair(450, false)).toBe(false); // 450 VA is only offered subsidised
    expect(withPair(1234, false)).toBe(false);
  });

  it("reject a monthly spend above what the connection could use", () => {
    // 2,200 VA ceiling is Rp2,489,142.06 (arithmetic in maxMonthlySpendRp).
    const ceiling = maxMonthlySpendRp(2200, false);
    expect(ceiling).toBeCloseTo(2489142.06, 1);
    const spend = (amount: number) =>
      electricitySchema.safeParse({ ...validInputs.electricity, monthlySpendRp: [amount] });

    expect(spend(Math.floor(ceiling)).success).toBe(true);
    const over = spend(Math.floor(ceiling) + 1);
    expect(over.success).toBe(false);
    if (!over.success) {
      expect(messageKeysByField(over.error)["monthlySpendRp.0"]).toBe("errors.billTooHigh");
    }
    // The extra zero this rule exists for: 650,000 typed as 6,500,000.
    expect(spend(6500000).success).toBe(false);
  });

  it("refuse a lifestyle question nobody answered", () => {
    const result = lifestyleSchema.safeParse({ ...validInputs.lifestyle, daytimeAc: null });
    expect(result.success).toBe(false);
  });

  it("refuse a roof with no area", () => {
    expect(roofSchema.safeParse({ ...validInputs.roof, areaM2: null }).success).toBe(false);
  });
});

describe("error messages", () => {
  // Every message key a schema can produce must exist in both languages.
  const keysUsedBySchemas = [
    "errors.billRequired",
    "errors.billNotWhole",
    "errors.billZero",
    "errors.billTooHigh",
    "errors.billingRequired",
    "errors.powerRequired",
    "errors.tooManyMonths",
    "errors.answerRequired",
    "errors.latitudeInvalid",
    "errors.longitudeInvalid",
    "errors.areaInvalid",
    "errors.usableInvalid",
    "errors.facingRequired",
    "errors.slopeRequired",
    "errors.shadeRequired",
  ];

  function lookup(messages: unknown, key: string): unknown {
    return key
      .split(".")
      .reduce((node, part) => (node as Record<string, unknown>)?.[part], messages);
  }

  it("exist in Indonesian and English", () => {
    for (const key of keysUsedBySchemas) {
      expect(typeof lookup(idPlan, key), `id ${key}`).toBe("string");
      expect(typeof lookup(enPlan, key), `en ${key}`).toBe("string");
    }
  });

  it("are the ones the schemas really produce", () => {
    // Empty everything: collect every key the whole schema reports.
    const empty = engineInputsSchema.safeParse({
      location: { latitude: null, longitude: null },
      roof: { areaM2: null, usableFraction: 0.65, facing: null, slope: null, shade: null },
      electricity: { billing: "postpaid", connectedVa: null, subsidised: false, monthlySpendRp: [null] },
      lifestyle: { homeOnWeekdays: null, daytimeAc: null, workFromHome: null, electricVehicle: null },
    });
    expect(empty.success).toBe(false);
    if (!empty.success) {
      for (const message of Object.values(messageKeysByField(empty.error))) {
        expect(keysUsedBySchemas).toContain(message);
      }
    }
  });
});
