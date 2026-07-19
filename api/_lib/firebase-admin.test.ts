import { describe, expect, it } from "vitest";
import {
  isRestorableParticipant,
  isSameRestorableParticipant,
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
