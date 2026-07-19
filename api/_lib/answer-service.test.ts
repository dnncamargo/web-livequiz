import { describe, expect, it, vi } from "vitest";
import {
  getParticipantAnswerStatus,
  submitParticipantAnswer,
} from "./answer-service.js";

const storedAnswer = {
  questionId: "pergunta-1",
  selectedOptionIds: ["opcao-a"],
  answeredAt: 12_000,
  isCorrect: true,
  pointsAwarded: 950,
};

function buildRoom(phase: "question" | "revealing") {
  return {
    phase,
    currentQuestion: { id: "pergunta-1" },
    participants: {
      "participante-1": { moderationStatus: "waiting-approval" },
    },
    answers: { "pergunta-1": { "participante-1": storedAnswer } },
    participantScores: { "participante-1": 1_850 },
  };
}

describe("serviço de respostas", () => {
  it("confirma o envio sem antecipar acerto ou pontuação", async () => {
    const services = {
      submitParticipantAnswer: vi.fn().mockResolvedValue({
        outcome: "accepted",
        answer: storedAnswer,
        totalScore: 1_850,
      }),
    };

    await expect(
      submitParticipantAnswer(
        "participante-1",
        {
          gameId: "ABC234",
          questionId: "pergunta-1",
          selectedOptionIds: ["opcao-a"],
        },
        services,
        () => 12_000,
      ),
    ).resolves.toEqual({
      created: true,
      answer: {
        questionId: "pergunta-1",
        selectedOptionIds: ["opcao-a"],
        answeredAt: 12_000,
      },
    });
    expect(services.submitParticipantAnswer).toHaveBeenCalledWith(
      "ABC234",
      "participante-1",
      "pergunta-1",
      ["opcao-a"],
      12_000,
    );
  });

  it("trata o reenvio como operação idempotente", async () => {
    const services = {
      submitParticipantAnswer: vi.fn().mockResolvedValue({
        outcome: "already-submitted",
        answer: storedAnswer,
        totalScore: 1_850,
      }),
    };

    await expect(
      submitParticipantAnswer(
        "participante-1",
        {
          gameId: "ABC234",
          questionId: "pergunta-1",
          selectedOptionIds: ["opcao-b"],
        },
        services,
      ),
    ).resolves.toMatchObject({ created: false });
  });

  it("explica quando o prazo oficial terminou", async () => {
    const services = {
      submitParticipantAnswer: vi.fn().mockResolvedValue({
        outcome: "answer-too-late",
        answer: null,
        totalScore: 0,
      }),
    };

    await expect(
      submitParticipantAnswer(
        "participante-1",
        {
          gameId: "ABC234",
          questionId: "pergunta-1",
          selectedOptionIds: ["opcao-a"],
        },
        services,
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "answer-too-late",
    });
  });

  it("oculta o resultado enquanto a pergunta recebe respostas", async () => {
    const services = {
      getWaitingRoom: vi.fn().mockResolvedValue(buildRoom("question")),
    };

    await expect(
      getParticipantAnswerStatus(
        "participante-1",
        { gameId: "ABC234", questionId: "pergunta-1" },
        services,
      ),
    ).resolves.toEqual({
      questionId: "pergunta-1",
      selectedOptionIds: ["opcao-a"],
      answeredAt: 12_000,
    });
  });

  it("revela o resultado e o total somente na fase de revelação", async () => {
    const services = {
      getWaitingRoom: vi.fn().mockResolvedValue(buildRoom("revealing")),
    };

    await expect(
      getParticipantAnswerStatus(
        "participante-1",
        { gameId: "ABC234", questionId: "pergunta-1" },
        services,
      ),
    ).resolves.toMatchObject({
      result: {
        isCorrect: true,
        pointsAwarded: 950,
        totalScore: 1_850,
      },
    });
  });
});
