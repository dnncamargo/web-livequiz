import { describe, expect, it } from "vitest";
import { calculateAnswerPoints } from "./scoring";

describe("pontuação de respostas", () => {
  it("concede a pontuação integral para uma resposta imediata", () => {
    expect(
      calculateAnswerPoints({
        questionPoints: 1_000,
        startedAt: 10_000,
        durationMs: 20_000,
        answeredAt: 10_000,
        isCorrect: true,
      }),
    ).toBe(1_000);
  });

  it("reduz gradualmente o bônus de velocidade até metade dos pontos", () => {
    expect(
      calculateAnswerPoints({
        questionPoints: 1_000,
        startedAt: 10_000,
        durationMs: 20_000,
        answeredAt: 20_000,
        isCorrect: true,
      }),
    ).toBe(750);
    expect(
      calculateAnswerPoints({
        questionPoints: 1_000,
        startedAt: 10_000,
        durationMs: 20_000,
        answeredAt: 30_000,
        isCorrect: true,
      }),
    ).toBe(500);
  });

  it("não concede pontos para uma resposta incorreta", () => {
    expect(
      calculateAnswerPoints({
        questionPoints: 1_000,
        startedAt: 10_000,
        durationMs: 20_000,
        answeredAt: 12_000,
        isCorrect: false,
      }),
    ).toBe(0);
  });
});
