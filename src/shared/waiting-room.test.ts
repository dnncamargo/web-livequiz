import { describe, expect, it } from "vitest";
import { publicWaitingRoomSchema } from "./waiting-room";

const publicQuestion = {
  id: "pergunta-1",
  type: "single-choice" as const,
  prompt: "Qual é a capital do Brasil?",
  position: 0,
  durationMs: 20_000,
  points: 1_000,
  options: [
    { id: "opcao-a", label: "Brasília" },
    { id: "opcao-b", label: "Salvador" },
  ],
};

describe("projeção pública da sala", () => {
  it("aceita a pergunta sem o gabarito durante a fase de resposta", () => {
    expect(
      publicWaitingRoomSchema.safeParse({
        id: "ABC234",
        phase: "question",
        createdAt: 1_000,
        participantCount: 2,
        currentQuestion: publicQuestion,
        questionNumber: 1,
        totalQuestions: 1,
      }).success,
    ).toBe(true);
  });

  it("rejeita uma pergunta pública que antecipe o gabarito", () => {
    expect(
      publicWaitingRoomSchema.safeParse({
        id: "ABC234",
        phase: "question",
        createdAt: 1_000,
        participantCount: 2,
        currentQuestion: {
          ...publicQuestion,
          correctOptionIds: ["opcao-a"],
        },
      }).success,
    ).toBe(false);
  });

  it("rejeita a projeção do gabarito antes da fase de revelação", () => {
    expect(
      publicWaitingRoomSchema.safeParse({
        id: "ABC234",
        phase: "question",
        createdAt: 1_000,
        participantCount: 2,
        currentQuestion: publicQuestion,
        revealedCorrectOptionIds: ["opcao-a"],
      }).success,
    ).toBe(false);
  });
});
