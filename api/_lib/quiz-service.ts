import {
  createQuizRequestSchema,
  changeQuizStatusRequestSchema,
  quizDetailSchema,
  quizSchema,
  updateQuizContentRequestSchema,
  type ChangeQuizStatusRequest,
  type CreateQuizRequest,
  type Quiz,
  type QuizDetail,
  type UpdateQuizContentRequest,
} from "../../src/shared/quiz.js";
import type { FirebaseAdminServices } from "./firebase-admin.js";
import { HttpError } from "./http-error.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseQuiz(quizId: string, value: unknown): Quiz {
  const result = quizSchema.safeParse(
    typeof value === "object" && value !== null
      ? { ...value, id: quizId }
      : value,
  );

  if (!result.success) {
    throw new HttpError(
      500,
      "quiz-state-invalid",
      "Um quiz salvo contém dados inválidos.",
    );
  }

  return result.data;
}

function parseQuizDetail(quizId: string, value: unknown): QuizDetail {
  const storedValue = isRecord(value) ? value : null;
  const result = quizDetailSchema.safeParse(
    storedValue
      ? {
          ...storedValue,
          id: quizId,
          questions: storedValue.questions ?? [],
        }
      : value,
  );

  if (!result.success) {
    throw new HttpError(
      500,
      "quiz-state-invalid",
      "Um quiz salvo contém perguntas ou metadados inválidos.",
    );
  }

  return result.data;
}

export async function createQuiz(
  ownerId: string,
  input: CreateQuizRequest,
  services: FirebaseAdminServices,
  now: () => number = Date.now,
): Promise<Quiz> {
  const parsedInput = createQuizRequestSchema.parse(input);
  const createdAt = now();
  const created = await services.createQuiz(ownerId, parsedInput, createdAt);

  return parseQuiz(created.quizId, created.quiz);
}

export async function listQuizzes(
  ownerId: string,
  services: FirebaseAdminServices,
): Promise<Quiz[]> {
  const quizzes = await services.findQuizzes(ownerId);

  return quizzes
    .map(({ quizId, quiz }) => parseQuiz(quizId, quiz))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function getOwnedQuiz(
  ownerId: string,
  quizId: string,
  services: FirebaseAdminServices,
): Promise<Quiz> {
  const value = await services.getQuiz(quizId);

  if (!value) {
    throw new HttpError(404, "quiz-not-found", "O quiz não foi encontrado.");
  }

  const quiz = parseQuiz(quizId, value);

  if (quiz.ownerId !== ownerId) {
    throw new HttpError(
      403,
      "quiz-owner-required",
      "Este quiz pertence a outro administrador.",
    );
  }

  return quiz;
}

export async function getQuizDetail(
  ownerId: string,
  quizId: string,
  services: FirebaseAdminServices,
): Promise<QuizDetail> {
  const value = await services.getQuiz(quizId);

  if (!value) {
    throw new HttpError(404, "quiz-not-found", "O quiz não foi encontrado.");
  }

  const quiz = parseQuizDetail(quizId, value);

  if (quiz.ownerId !== ownerId) {
    throw new HttpError(
      403,
      "quiz-owner-required",
      "Este quiz pertence a outro administrador.",
    );
  }

  return quiz;
}

export async function updateQuizContent(
  ownerId: string,
  input: UpdateQuizContentRequest,
  services: FirebaseAdminServices,
  now: () => number = Date.now,
): Promise<QuizDetail> {
  const parsedInput = updateQuizContentRequestSchema.parse(input);
  const quiz = await getQuizDetail(ownerId, parsedInput.quizId, services);

  if (quiz.status === "archived") {
    throw new HttpError(
      409,
      "archived-quiz-read-only",
      "Restaure o quiz antes de editar seu conteúdo.",
    );
  }

  const questions = parsedInput.questions.map((question, position) => ({
    ...question,
    position,
  }));
  const updated = await services.updateQuizContent(
    quiz.id,
    {
      title: parsedInput.title,
      description: parsedInput.description,
      questions,
    },
    now(),
  );

  if (parsedInput.title !== quiz.title) {
    await services.syncQuizTitleWithWaitingRooms(
      ownerId,
      quiz.id,
      parsedInput.title,
    );
  }

  return parseQuizDetail(quiz.id, updated);
}

export async function changeQuizStatus(
  ownerId: string,
  input: ChangeQuizStatusRequest,
  services: FirebaseAdminServices,
  now: () => number = Date.now,
): Promise<Quiz> {
  const parsedInput = changeQuizStatusRequestSchema.parse(input);
  const quiz = await getOwnedQuiz(ownerId, parsedInput.quizId, services);
  const nextStatus =
    parsedInput.action === "publish-quiz"
      ? "published"
      : parsedInput.action === "archive-quiz"
        ? "archived"
        : "draft";
  const validTransition =
    (parsedInput.action === "publish-quiz" && quiz.status === "draft") ||
    (parsedInput.action === "archive-quiz" && quiz.status !== "archived") ||
    (parsedInput.action === "restore-quiz" && quiz.status === "archived");

  if (!validTransition) {
    throw new HttpError(
      409,
      "invalid-quiz-transition",
      "O quiz não pode assumir esse estado a partir da situação atual.",
    );
  }

  if (parsedInput.action === "publish-quiz" && quiz.questionCount === 0) {
    throw new HttpError(
      409,
      "quiz-has-no-questions",
      "Adicione pelo menos uma pergunta antes de publicar o quiz.",
    );
  }

  const updated = await services.updateQuizStatus(quiz.id, nextStatus, now());

  if (parsedInput.action === "archive-quiz") {
    await services.detachQuizFromWaitingRooms(ownerId, quiz.id);
  }

  return parseQuiz(quiz.id, updated);
}
