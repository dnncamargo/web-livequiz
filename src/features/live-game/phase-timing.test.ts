import { describe, expect, it } from "vitest";
import { getRemainingPhaseSeconds } from "./phase-timing";

describe("cronometragem da fase", () => {
  it("calcula o tempo restante a partir do instante oficial", () => {
    const timing = { startedAt: 10_000, durationMs: 20_000 };

    expect(getRemainingPhaseSeconds(timing, 10_001)).toBe(20);
    expect(getRemainingPhaseSeconds(timing, 29_001)).toBe(1);
  });

  it("nunca apresenta valores negativos", () => {
    expect(
      getRemainingPhaseSeconds(
        { startedAt: 10_000, durationMs: 5_000 },
        20_000,
      ),
    ).toBe(0);
  });
});
