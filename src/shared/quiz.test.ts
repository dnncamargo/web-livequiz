import { describe, expect, it } from "vitest";
import { createQuizRequestSchema, quizQuestionSchema } from "./quiz";

describe("modelo de quiz", () => {
  it("normaliza os dados editoriais iniciais", () => {
    expect(
      createQuizRequestSchema.parse({
        title: "  Ciências e natureza  ",
        description: "  Quiz do oitavo ano  ",
      }),
    ).toEqual({
      title: "Ciências e natureza",
      description: "Quiz do oitavo ano",
    });
  });

  it("exige duas alternativas em verdadeiro ou falso", () => {
    const result = quizQuestionSchema.safeParse({
      id: "question-1",
      type: "true-false",
      prompt: "A água ferve a 100 °C ao nível do mar?",
      position: 0,
      durationMs: 20_000,
      points: 1_000,
      options: [
        { id: "true", label: "Verdadeiro" },
        { id: "false", label: "Falso" },
        { id: "maybe", label: "Talvez" },
      ],
      correctOptionIds: ["true"],
    });

    expect(result.success).toBe(false);
  });
});
