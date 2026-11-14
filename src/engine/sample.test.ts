import { describe, expect, it } from "vitest";
import { kilowattHoursFromWattHours } from "./sample";

describe("kilowattHoursFromWattHours", () => {
  it("converts 2,500 Wh to 2.5 kWh", () => {
    expect(kilowattHoursFromWattHours(2500)).toBe(2.5);
  });
});
