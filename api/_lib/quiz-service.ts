import {
  createQuizRequestSchema,
  quizSchema,
  type CreateQuizRequest,
  type Quiz,
} from "../../src/shared/quiz.js";
import type { FirebaseAdminServices } from "./firebase-admin.js";
import { HttpError } from "./http-error.js";

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
