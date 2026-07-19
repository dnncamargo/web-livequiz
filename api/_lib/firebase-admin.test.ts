import { describe, expect, it } from "vitest";
import {
  isRestorableParticipant,
  isSameRestorableParticipant,
  resolveParticipantAnswerTransaction,
  resolveParticipantTransactionGame,
} from "./firebase-admin.js";

describe("transação de entrada do participante", () => {
  const previouslyLoadedGame = {
    ownerId: "administrador-1",
    phase: "waiting",
    createdAt: 1_000,
  };

  it("usa a sala previamente consultada quando a primeira execução recebe null", () => {
    expect(resolveParticipantTransactionGame(null, previouslyLoadedGame)).toBe(
      previouslyLoadedGame,
    );
  });

  it("prioriza o estado atual fornecido nas novas tentativas", () => {
    const currentGame = { ...previouslyLoadedGame, updatedAt: 2_000 };

    expect(
      resolveParticipantTransactionGame(currentGame, previouslyLoadedGame),
    ).toBe(currentGame);
  });

  it("rejeita um valor inesperado que não representa uma sala", () => {
    expect(
      resolveParticipantTransactionGame(undefined, previouslyLoadedGame),
    ).toBeNull();
  });
});

describe("reentrada do participante", () => {
  it("restaura somente participantes que não foram removidos", () => {
    expect(
      isRestorableParticipant({ moderationStatus: "waiting-approval" }),
    ).toBe(true);
    expect(isRestorableParticipant({ moderationStatus: "approved" })).toBe(
      true,
    );
    expect(isRestorableParticipant({ moderationStatus: "removed" })).toBe(
      false,
    );
  });

  it("restaura apenas quando nickname e avatar continuam iguais", () => {
    const participant = {
      nickname: "Estrela Azul",
      avatar: "🦊",
      moderationStatus: "waiting-approval",
    };

    expect(isSameRestorableParticipant(participant, "Estrela Azul", "🦊")).toBe(
      true,
    );
    expect(isSameRestorableParticipant(participant, "Cometa", "🦊")).toBe(
      false,
    );
    expect(isSameRestorableParticipant(participant, "Estrela Azul", "🐼")).toBe(
      false,
    );
    expect(
      isSameRestorableParticipant(
        { ...participant, moderationStatus: "removed" },
        "Estrela Azul",
        "🦊",
      ),
    ).toBe(false);
  });
});

describe("transação de resposta do participante", () => {
  const activeGame = {
    phase: "question",
    phaseTiming: { startedAt: 10_000, durationMs: 20_000 },
    currentQuestion: {
      id: "pergunta-1",
      type: "single-choice",
      prompt: "Qual é a capital do Brasil?",
      position: 0,
      durationMs: 20_000,
      points: 1_000,
      options: [
        { id: "opcao-a", label: "Brasília" },
        { id: "opcao-b", label: "Salvador" },
      ],
      correctOptionIds: ["opcao-a"],
    },
    participants: {
      "participante-1": {
        nickname: "Estrela Azul",
        moderationStatus: "waiting-approval",
      },
    },
    participantScores: { "participante-1": 100 },
  };

  it("registra e pontua a resposta correta com bônus de velocidade", () => {
    const decision = resolveParticipantAnswerTransaction(activeGame, {
      participantId: "participante-1",
      questionId: "pergunta-1",
      selectedOptionIds: ["opcao-a"],
      answeredAt: 20_000,
    });

    expect(decision).toMatchObject({
      outcome: "accepted",
      answer: {
        questionId: "pergunta-1",
        isCorrect: true,
        pointsAwarded: 750,
      },
      totalScore: 850,
      game: {
        participantScores: { "participante-1": 850 },
      },
    });
  });

  it("mantém a primeira resposta em reenvios e não duplica os pontos", () => {
    const firstDecision = resolveParticipantAnswerTransaction(activeGame, {
      participantId: "participante-1",
      questionId: "pergunta-1",
      selectedOptionIds: ["opcao-a"],
      answeredAt: 20_000,
    });
    const repeatedDecision = resolveParticipantAnswerTransaction(
      firstDecision.game,
      {
        participantId: "participante-1",
        questionId: "pergunta-1",
        selectedOptionIds: ["opcao-b"],
        answeredAt: 21_000,
      },
    );

    expect(repeatedDecision).toMatchObject({
      outcome: "already-submitted",
      answer: { selectedOptionIds: ["opcao-a"] },
      totalScore: 850,
    });
  });

  it("rejeita uma resposta recebida depois do prazo oficial", () => {
    expect(
      resolveParticipantAnswerTransaction(activeGame, {
        participantId: "participante-1",
        questionId: "pergunta-1",
        selectedOptionIds: ["opcao-a"],
        answeredAt: 30_001,
      }),
    ).toMatchObject({ outcome: "answer-too-late", answer: null });
  });
});
