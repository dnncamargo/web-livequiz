import { z } from "zod";

export const QUIZ_TITLE_MIN_LENGTH = 3;
export const QUIZ_TITLE_MAX_LENGTH = 100;
export const QUIZ_DESCRIPTION_MAX_LENGTH = 500;

export const questionTypeSchema = z.enum(["single-choice", "true-false"]);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const quizStatusSchema = z.enum(["draft", "published", "archived"]);
export type QuizStatus = z.infer<typeof quizStatusSchema>;
export const quizIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,128}$/, "O identificador do quiz é inválido.");

export const quizOptionSchema = z.object({
  id: z.string().min(1).max(128),
  label: z.string().trim().min(1).max(200),
});
export type QuizOption = z.infer<typeof quizOptionSchema>;

export const quizQuestionSchema = z
  .object({
    id: z.string().min(1).max(128),
    type: questionTypeSchema,
    prompt: z.string().trim().min(1).max(500),
    position: z.number().int().nonnegative(),
    durationMs: z.number().int().min(5_000).max(120_000),
    points: z.number().int().min(0).max(10_000),
    options: z.array(quizOptionSchema).min(2).max(6),
    correctOptionIds: z.array(z.string().min(1).max(128)).length(1),
  })
  .superRefine((question, context) => {
    const optionIds = new Set(question.options.map(({ id }) => id));

    if (!optionIds.has(question.correctOptionIds[0] ?? "")) {
      context.addIssue({
        code: "custom",
        path: ["correctOptionIds"],
        message: "A resposta correta deve apontar para uma alternativa.",
      });
    }

    if (question.type === "true-false" && question.options.length !== 2) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message:
          "Uma pergunta de verdadeiro ou falso deve ter duas alternativas.",
      });
    }
  });
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const createQuizRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(
      QUIZ_TITLE_MIN_LENGTH,
      "Informe um título com pelo menos 3 caracteres.",
    )
    .max(QUIZ_TITLE_MAX_LENGTH, "Use no máximo 100 caracteres no título."),
  description: z
    .string()
    .trim()
    .max(
      QUIZ_DESCRIPTION_MAX_LENGTH,
      "Use no máximo 500 caracteres na descrição.",
    ),
});
export type CreateQuizRequest = z.infer<typeof createQuizRequestSchema>;

export const quizSchema = z.object({
  id: quizIdSchema,
  ownerId: z.string().min(1),
  title: createQuizRequestSchema.shape.title,
  description: createQuizRequestSchema.shape.description,
  status: quizStatusSchema,
  questionCount: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type Quiz = z.infer<typeof quizSchema>;

export const quizResponseSchema = z.object({ quiz: quizSchema });
export const quizListResponseSchema = z.object({
  quizzes: z.array(quizSchema),
});

export const changeQuizStatusRequestSchema = z
  .object({
    quizId: quizIdSchema,
    action: z.enum(["publish-quiz", "archive-quiz", "restore-quiz"]),
  })
  .strict();
export type ChangeQuizStatusRequest = z.infer<
  typeof changeQuizStatusRequestSchema
>;
