import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAnswerStatus, submitAnswer } from "./participant-answer";

const user = { getIdToken: vi.fn() };
const answer = {
  questionId: "pergunta-1",
  selectedOptionIds: ["opcao-a"],
  answeredAt: 12_000,
};

describe("cliente de respostas", () => {
  beforeEach(() => {
    user.getIdToken.mockReset().mockResolvedValue("token-participante");
  });

  it("envia somente a alternativa escolhida e os identificadores da rodada", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ answer }), { status: 201 }),
      );

    await expect(
      submitAnswer(
        user,
        {
          gameId: "abc234",
          questionId: "pergunta-1",
          selectedOptionIds: ["opcao-a"],
        },
        { fetch: fetchMock },
      ),
    ).resolves.toEqual(answer);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/answers",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer token-participante",
        }),
        body: JSON.stringify({
          gameId: "ABC234",
          questionId: "pergunta-1",
          selectedOptionIds: ["opcao-a"],
        }),
      }),
    );
  });

  it("recupera a resposta e o resultado revelado após atualizar a página", async () => {
    const revealedAnswer = {
      ...answer,
      result: { isCorrect: true, pointsAwarded: 950, totalScore: 1_850 },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ answer: revealedAnswer }), {
        status: 200,
      }),
    );

    await expect(
      getAnswerStatus(
        user,
        { gameId: "ABC234", questionId: "pergunta-1" },
        { fetch: fetchMock },
      ),
    ).resolves.toEqual(revealedAnswer);
  });

  it("trata a ausência de resposta como estado vazio", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "answer-not-found",
            message: "Nenhuma resposta foi registrada.",
          },
        }),
        { status: 404 },
      ),
    );

    await expect(
      getAnswerStatus(
        user,
        { gameId: "ABC234", questionId: "pergunta-1" },
        { fetch: fetchMock },
      ),
    ).resolves.toBeNull();
  });
});
