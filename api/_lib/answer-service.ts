import { z } from "zod";
import {
  participantAnswerQuerySchema,
  participantAnswerStatusSchema,
  storedParticipantAnswerSchema,
  submitParticipantAnswerRequestSchema,
  type ParticipantAnswerQuery,
  type ParticipantAnswerStatus,
  type SubmitParticipantAnswerRequest,
} from "../../src/shared/answer.js";
import { participantModerationStatusSchema } from "../../src/shared/participant.js";
import { waitingRoomPhaseSchema } from "../../src/shared/waiting-room.js";
import type {
  FirebaseAdminServices,
  ParticipantAnswerPersistenceOutcome,
} from "./firebase-admin.js";
import { HttpError } from "./http-error.js";

const answerRoomSchema = z.object({
  phase: waitingRoomPhaseSchema,
  currentQuestion: z.object({ id: z.string().min(1) }).optional(),
  participants: z
    .record(
      z.string(),
      z.object({ moderationStatus: participantModerationStatusSchema }),
    )
    .optional(),
  answers: z
    .record(z.string(), z.record(z.string(), storedParticipantAnswerSchema))
    .optional(),
  participantScores: z
    .record(z.string(), z.number().int().nonnegative())
    .optional(),
});

function throwAnswerPersistenceError(
  outcome: ParticipantAnswerPersistenceOutcome,
): never {
  switch (outcome) {
    case "room-not-found":
      throw new HttpError(404, outcome, "A sala não está mais disponível.");
    case "participant-not-found":
      throw new HttpError(
        404,
        outcome,
        "Sua participação não foi encontrada nesta sala.",
      );
    case "participant-not-eligible":
      throw new HttpError(
        403,
        outcome,
        "Sua participação não está autorizada a responder.",
      );
    case "question-not-active":
      throw new HttpError(
        409,
        outcome,
        "A pergunta não está recebendo respostas agora.",
      );
    case "question-mismatch":
      throw new HttpError(
        409,
        outcome,
        "Esta pergunta não é mais a pergunta ativa.",
      );
    case "answer-too-late":
      throw new HttpError(
        409,
        outcome,
        "O tempo para responder esta pergunta terminou.",
      );
    case "invalid-option":
      throw new HttpError(
        400,
        outcome,
        "A alternativa selecionada não pertence à pergunta.",
      );
    case "game-state-invalid":
      throw new HttpError(
        500,
        outcome,
        "A partida contém um estado inválido para receber respostas.",
      );
    case "accepted":
    case "already-submitted":
      throw new HttpError(
        500,
        "answer-result-invalid",
        "O servidor não conseguiu confirmar a resposta registrada.",
      );
  }
}

function toSafeAnswerStatus(answer: {
  questionId: string;
  selectedOptionIds: string[];
  answeredAt: number;
}): ParticipantAnswerStatus {
  return participantAnswerStatusSchema.parse({
    questionId: answer.questionId,
    selectedOptionIds: answer.selectedOptionIds,
    answeredAt: answer.answeredAt,
  });
}

export async function submitParticipantAnswer(
  participantId: string,
  input: SubmitParticipantAnswerRequest,
  services: Pick<FirebaseAdminServices, "submitParticipantAnswer">,
  now: () => number = Date.now,
): Promise<{ answer: ParticipantAnswerStatus; created: boolean }> {
  const parsedInput = submitParticipantAnswerRequestSchema.parse(input);
  const persistence = await services.submitParticipantAnswer(
    parsedInput.gameId,
    participantId,
    parsedInput.questionId,
    parsedInput.selectedOptionIds,
    now(),
  );

  if (
    (persistence.outcome !== "accepted" &&
      persistence.outcome !== "already-submitted") ||
    !persistence.answer
  ) {
    throwAnswerPersistenceError(persistence.outcome);
  }

  return {
    answer: toSafeAnswerStatus(persistence.answer),
    created: persistence.outcome === "accepted",
  };
}

export async function getParticipantAnswerStatus(
  participantId: string,
  input: ParticipantAnswerQuery,
  services: Pick<FirebaseAdminServices, "getWaitingRoom">,
): Promise<ParticipantAnswerStatus> {
  const parsedInput = participantAnswerQuerySchema.parse(input);
  const roomValue = await services.getWaitingRoom(parsedInput.gameId);

  if (roomValue === null) {
    throw new HttpError(404, "room-not-found", "A sala não está disponível.");
  }

  const roomResult = answerRoomSchema.safeParse(roomValue);

  if (!roomResult.success) {
    throw new HttpError(
      500,
      "game-state-invalid",
      "A partida contém dados inválidos.",
    );
  }

  const participant = roomResult.data.participants?.[participantId];

  if (!participant) {
    throw new HttpError(
      404,
      "participant-not-found",
      "Sua participação não foi encontrada nesta sala.",
    );
  }

  if (participant.moderationStatus === "removed") {
    throw new HttpError(
      403,
      "participant-not-eligible",
      "Sua participação não está autorizada a consultar respostas.",
    );
  }

  const answer =
    roomResult.data.answers?.[parsedInput.questionId]?.[participantId];

  if (!answer) {
    throw new HttpError(
      404,
      "answer-not-found",
      "Nenhuma resposta foi registrada para esta pergunta.",
    );
  }

  const canRevealResult =
    roomResult.data.phase === "revealing" &&
    roomResult.data.currentQuestion?.id === parsedInput.questionId;

  return participantAnswerStatusSchema.parse({
    questionId: answer.questionId,
    selectedOptionIds: answer.selectedOptionIds,
    answeredAt: answer.answeredAt,
    ...(canRevealResult
      ? {
          result: {
            isCorrect: answer.isCorrect,
            pointsAwarded: answer.pointsAwarded,
            totalScore: roomResult.data.participantScores?.[participantId] ?? 0,
          },
        }
      : {}),
  });
}
