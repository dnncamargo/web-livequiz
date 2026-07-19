import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FirebaseAdminServices } from "./firebase-admin.js";
import { changeQuizStatus, createQuiz, listQuizzes } from "./quiz-service.js";

function createServices(): Pick<
  FirebaseAdminServices,
  | "createQuiz"
  | "findQuizzes"
  | "getQuiz"
  | "updateQuizStatus"
  | "detachQuizFromWaitingRooms"
> {
  return {
    createQuiz: vi.fn(),
    findQuizzes: vi.fn(),
    getQuiz: vi.fn(),
    updateQuizStatus: vi.fn(),
    detachQuizFromWaitingRooms: vi.fn(),
  };
}

describe("serviço de quizzes", () => {
  let services: ReturnType<typeof createServices>;

  beforeEach(() => {
    services = createServices();
  });

  it("cria um quiz vazio em rascunho", async () => {
    vi.mocked(services.createQuiz).mockResolvedValue({
      quizId: "quiz-1",
      quiz: {
        ownerId: "administrador-1",
        title: "Ciências",
        description: "Oitavo ano",
        status: "draft",
        questionCount: 0,
        createdAt: 1_000,
        updatedAt: 1_000,
      },
    });

    await expect(
      createQuiz(
        "administrador-1",
        { title: "Ciências", description: "Oitavo ano" },
        services as FirebaseAdminServices,
        () => 1_000,
      ),
    ).resolves.toMatchObject({ id: "quiz-1", status: "draft" });
  });

  it("ordena a biblioteca pela atualização mais recente", async () => {
    vi.mocked(services.findQuizzes).mockResolvedValue(
      [
        { quizId: "antigo", updatedAt: 1_000 },
        { quizId: "novo", updatedAt: 2_000 },
      ].map(({ quizId, updatedAt }) => ({
        quizId,
        quiz: {
          ownerId: "administrador-1",
          title: quizId === "novo" ? "Quiz novo" : "Quiz antigo",
          description: "",
          status: "draft",
          questionCount: 0,
          createdAt: updatedAt,
          updatedAt,
        },
      })),
    );

    const quizzes = await listQuizzes(
      "administrador-1",
      services as FirebaseAdminServices,
    );

    expect(quizzes.map(({ id }) => id)).toEqual(["novo", "antigo"]);
  });

  it("publica um rascunho pertencente ao administrador", async () => {
    const draft = {
      ownerId: "administrador-1",
      title: "Ciências",
      description: "",
      status: "draft",
      questionCount: 0,
      createdAt: 1_000,
      updatedAt: 1_000,
    } as const;
    vi.mocked(services.getQuiz).mockResolvedValue(draft);
    vi.mocked(services.updateQuizStatus).mockResolvedValue({
      ...draft,
      status: "published",
      updatedAt: 2_000,
    });

    await expect(
      changeQuizStatus(
        "administrador-1",
        { quizId: "quiz-1", action: "publish-quiz" },
        services as FirebaseAdminServices,
        () => 2_000,
      ),
    ).resolves.toMatchObject({ id: "quiz-1", status: "published" });
  });

  it("desassocia o quiz das salas ativas quando ele é arquivado", async () => {
    const published = {
      ownerId: "administrador-1",
      title: "Ciências",
      description: "",
      status: "published",
      questionCount: 0,
      createdAt: 1_000,
      updatedAt: 1_000,
    } as const;
    vi.mocked(services.getQuiz).mockResolvedValue(published);
    vi.mocked(services.updateQuizStatus).mockResolvedValue({
      ...published,
      status: "archived",
      updatedAt: 2_000,
    });

    await changeQuizStatus(
      "administrador-1",
      { quizId: "quiz-1", action: "archive-quiz" },
      services as FirebaseAdminServices,
      () => 2_000,
    );

    expect(services.detachQuizFromWaitingRooms).toHaveBeenCalledWith(
      "administrador-1",
      "quiz-1",
    );
  });
});
