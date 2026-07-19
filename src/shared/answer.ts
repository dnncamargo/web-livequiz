import { z } from "zod";
import { participantGameCodeSchema } from "./participant.js";

const answerIdentifierSchema = z.string().min(1).max(128);

export const submitParticipantAnswerRequestSchema = z
  .object({
    gameId: participantGameCodeSchema,
    questionId: answerIdentifierSchema,
    selectedOptionIds: z.array(answerIdentifierSchema).length(1),
  })
  .strict();

export const participantAnswerQuerySchema = z
  .object({
    gameId: participantGameCodeSchema,
    questionId: answerIdentifierSchema,
  })
  .strict();

export const participantAnswerStatusSchema = z
  .object({
    questionId: answerIdentifierSchema,
    selectedOptionIds: z.array(answerIdentifierSchema).length(1),
    answeredAt: z.number().int().nonnegative(),
    result: z
      .object({
        isCorrect: z.boolean(),
        pointsAwarded: z.number().int().nonnegative(),
        totalScore: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const storedParticipantAnswerSchema = z
  .object({
    questionId: answerIdentifierSchema,
    selectedOptionIds: z.array(answerIdentifierSchema).length(1),
    answeredAt: z.number().int().nonnegative(),
    isCorrect: z.boolean(),
    pointsAwarded: z.number().int().nonnegative(),
  })
  .strict();

export const participantAnswerResponseSchema = z
  .object({ answer: participantAnswerStatusSchema })
  .strict();

export type SubmitParticipantAnswerRequest = z.infer<
  typeof submitParticipantAnswerRequestSchema
>;
export type ParticipantAnswerQuery = z.infer<
  typeof participantAnswerQuerySchema
>;
export type ParticipantAnswerStatus = z.infer<
  typeof participantAnswerStatusSchema
>;
export type StoredParticipantAnswer = z.infer<
  typeof storedParticipantAnswerSchema
>;
