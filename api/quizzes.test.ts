import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./quizzes.js";

const apiMocks = vi.hoisted(() => ({
  services: { name: "firebase-admin-services" },
  authorizeAdministratorRequest: vi.fn(),
  createQuiz: vi.fn(),
  listQuizzes: vi.fn(),
}));

vi.mock("./_lib/firebase-admin.js", () => ({
  getFirebaseAdminServices: () => apiMocks.services,
}));

vi.mock("./_lib/administrator-authorization.js", () => ({
  authorizeAdministratorRequest: apiMocks.authorizeAdministratorRequest,
}));

vi.mock("./_lib/quiz-service.js", () => ({
  createQuiz: apiMocks.createQuiz,
  listQuizzes: apiMocks.listQuizzes,
}));

const quiz = {
  id: "quiz-1",
  ownerId: "administrador-1",
  title: "Ciências",
  description: "Oitavo ano",
  status: "draft",
  questionCount: 0,
  createdAt: 1_000,
  updatedAt: 1_000,
} as const;

describe("/api/quizzes", () => {
  beforeEach(() => {
    apiMocks.authorizeAdministratorRequest
      .mockReset()
      .mockResolvedValue({ uid: "administrador-1" });
    apiMocks.createQuiz.mockReset().mockResolvedValue(quiz);
    apiMocks.listQuizzes.mockReset().mockResolvedValue([quiz]);
  });

  it("cria um quiz para o administrador autenticado", async () => {
    const response = await POST(
      new Request("https://quizumba.example/api/quizzes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Ciências", description: "Oitavo ano" }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ quiz });
    expect(apiMocks.createQuiz).toHaveBeenCalledWith(
      "administrador-1",
      { title: "Ciências", description: "Oitavo ano" },
      apiMocks.services,
    );
  });

  it("lista somente a biblioteca autorizada pelo servidor", async () => {
    const response = await GET(
      new Request("https://quizumba.example/api/quizzes"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ quizzes: [quiz] });
    expect(apiMocks.listQuizzes).toHaveBeenCalledWith(
      "administrador-1",
      apiMocks.services,
    );
  });
});
