import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./answers.js";

const answerApiMocks = vi.hoisted(() => ({
  authorizeParticipantRequest: vi.fn(),
  getFirebaseAdminServices: vi.fn(),
  getParticipantAnswerStatus: vi.fn(),
  submitParticipantAnswer: vi.fn(),
  services: { name: "firebase-admin-services" },
}));

vi.mock("./_lib/firebase-admin.js", () => ({
  getFirebaseAdminServices: answerApiMocks.getFirebaseAdminServices,
}));

vi.mock("./_lib/participant-authorization.js", () => ({
  authorizeParticipantRequest: answerApiMocks.authorizeParticipantRequest,
}));

vi.mock("./_lib/answer-service.js", () => ({
  getParticipantAnswerStatus: answerApiMocks.getParticipantAnswerStatus,
  submitParticipantAnswer: answerApiMocks.submitParticipantAnswer,
}));

const safeAnswer = {
  questionId: "pergunta-1",
  selectedOptionIds: ["opcao-a"],
  answeredAt: 12_000,
};

describe("/api/answers", () => {
  beforeEach(() => {
    answerApiMocks.getFirebaseAdminServices
      .mockReset()
      .mockReturnValue(answerApiMocks.services);
    answerApiMocks.authorizeParticipantRequest
      .mockReset()
      .mockResolvedValue({ uid: "participante-1" });
    answerApiMocks.submitParticipantAnswer.mockReset().mockResolvedValue({
      answer: safeAnswer,
      created: true,
    });
    answerApiMocks.getParticipantAnswerStatus
      .mockReset()
      .mockResolvedValue(safeAnswer);
  });

  it("registra uma resposta vinculada ao UID anônimo", async () => {
    const response = await POST(
      new Request("https://quizumba.example/api/answers", {
        method: "POST",
        headers: { authorization: "Bearer token-participante" },
        body: JSON.stringify({
          gameId: " abc234 ",
          questionId: "pergunta-1",
          selectedOptionIds: ["opcao-a"],
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ answer: safeAnswer });
    expect(answerApiMocks.submitParticipantAnswer).toHaveBeenCalledWith(
      "participante-1",
      {
        gameId: "ABC234",
        questionId: "pergunta-1",
        selectedOptionIds: ["opcao-a"],
      },
      answerApiMocks.services,
    );
  });

  it("consulta a própria resposta sem confiar em um UID da URL", async () => {
    const response = await GET(
      new Request(
        "https://quizumba.example/api/answers?gameId=ABC234&questionId=pergunta-1",
        { headers: { authorization: "Bearer token-participante" } },
      ),
    );

    expect(response.status).toBe(200);
    expect(answerApiMocks.getParticipantAnswerStatus).toHaveBeenCalledWith(
      "participante-1",
      { gameId: "ABC234", questionId: "pergunta-1" },
      answerApiMocks.services,
    );
  });

  it("rejeita mais de uma alternativa para os tipos atuais", async () => {
    const response = await POST(
      new Request("https://quizumba.example/api/answers", {
        method: "POST",
        body: JSON.stringify({
          gameId: "ABC234",
          questionId: "pergunta-1",
          selectedOptionIds: ["opcao-a", "opcao-b"],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(answerApiMocks.submitParticipantAnswer).not.toHaveBeenCalled();
  });
});
