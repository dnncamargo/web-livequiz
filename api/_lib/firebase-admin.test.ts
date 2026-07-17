import { describe, expect, it } from "vitest";
import { resolveParticipantTransactionGame } from "./firebase-admin.js";

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
