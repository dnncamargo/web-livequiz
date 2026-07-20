import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { getAnswerOptionVisual } from "../../shared/answer-visuals";
import type { ParticipantAnswerStatus } from "../../shared/answer";
import type {
  PublicQuizQuestion,
  PublicWaitingRoom,
} from "../../shared/waiting-room";
import {
  getAnswerStatus,
  ParticipantAnswerRequestError,
  submitAnswer,
} from "./participant-answer";
import { AnswerOptionIcon } from "./AnswerOptionIcon";

interface ParticipantAnswerPanelProps {
  user: User;
  room: PublicWaitingRoom;
  question: PublicQuizQuestion;
  acceptingAnswers: boolean;
}

interface ScopedAnswerState {
  questionId: string;
  answer: ParticipantAnswerStatus | null;
  loading: boolean;
  submittingOptionId: string | null;
  error: string | null;
}

export function ParticipantAnswerPanel({
  user,
  room,
  question,
  acceptingAnswers,
}: ParticipantAnswerPanelProps) {
  const revealing = room.phase === "revealing";
  const [state, setState] = useState<ScopedAnswerState>({
    questionId: question.id,
    answer: null,
    loading: true,
    submittingOptionId: null,
    error: null,
  });

  useEffect(() => {
    let active = true;

    setState((current) => ({
      questionId: question.id,
      answer: current.questionId === question.id ? current.answer : null,
      loading: true,
      submittingOptionId: null,
      error: null,
    }));

    void getAnswerStatus(user, {
      gameId: room.id,
      questionId: question.id,
    })
      .then((answer) => {
        if (active) {
          setState({
            questionId: question.id,
            answer,
            loading: false,
            submittingOptionId: null,
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        console.error("Erro ao recuperar resposta do participante:", error);

        if (active) {
          setState((current) => ({
            ...current,
            questionId: question.id,
            loading: false,
            submittingOptionId: null,
            error:
              error instanceof ParticipantAnswerRequestError
                ? error.message
                : "Não foi possível verificar sua resposta.",
          }));
        }
      });

    return () => {
      active = false;
    };
  }, [question.id, revealing, room.id, user]);

  const answer = state.questionId === question.id ? state.answer : null;
  const selectedOptionId = answer?.selectedOptionIds[0] ?? null;
  const disabled =
    revealing ||
    state.loading ||
    state.submittingOptionId !== null ||
    selectedOptionId !== null ||
    !acceptingAnswers;

  async function selectOption(optionId: string) {
    if (disabled) {
      return;
    }

    setState((current) => ({
      ...current,
      submittingOptionId: optionId,
      error: null,
    }));

    try {
      const submittedAnswer = await submitAnswer(user, {
        gameId: room.id,
        questionId: question.id,
        selectedOptionIds: [optionId],
      });
      setState({
        questionId: question.id,
        answer: submittedAnswer,
        loading: false,
        submittingOptionId: null,
        error: null,
      });
    } catch (error) {
      console.error("Erro ao enviar resposta do participante:", error);
      setState((current) => ({
        ...current,
        submittingOptionId: null,
        error:
          error instanceof ParticipantAnswerRequestError
            ? error.message
            : "Não foi possível enviar sua resposta. Tente novamente.",
      }));
    }
  }

  return (
    <>
      <div
        className="participant-answer-options"
        role="group"
        aria-label="Alternativas da pergunta"
      >
        {question.options.map((option, index) => {
          const visual = getAnswerOptionVisual(index);
          const selected = selectedOptionId === option.id;
          const correct = Boolean(
            revealing && room.revealedCorrectOptionIds?.includes(option.id),
          );
          const selectedWrong = revealing && selected && !correct;
          const classNames = [
            "participant-answer-option",
            visual.className,
            selected ? "participant-answer-selected" : "",
            correct ? "participant-answer-correct" : "",
            selectedWrong ? "participant-answer-wrong" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={option.id}
              type="button"
              className={classNames}
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${visual.shapeName}: ${option.label}`}
              onClick={() => void selectOption(option.id)}
            >
              <span className="participant-answer-shape" aria-hidden="true">
                <AnswerOptionIcon shape={visual.shape} />
              </span>
              <strong>{option.label}</strong>
              {state.submittingOptionId === option.id && (
                <small>Enviando...</small>
              )}
              {correct && <small>Resposta correta</small>}
            </button>
          );
        })}
      </div>

      <div className="participant-answer-feedback" aria-live="polite">
        {state.loading && <span>Verificando sua resposta...</span>}
        {!state.loading && !revealing && selectedOptionId && (
          <strong>Resposta enviada. Aguarde a revelação.</strong>
        )}
        {!state.loading && !revealing && !acceptingAnswers && !answer && (
          <strong>Tempo encerrado.</strong>
        )}
        {revealing && !state.loading && !answer && (
          <strong>Você não respondeu esta pergunta.</strong>
        )}
        {revealing && answer?.result && (
          <div
            className={
              answer.result.isCorrect
                ? "participant-result-correct"
                : "participant-result-wrong"
            }
          >
            <strong>
              {answer.result.isCorrect
                ? "Resposta correta!"
                : "Não foi dessa vez."}
            </strong>
            <span>+{answer.result.pointsAwarded} pontos</span>
            <small>Total: {answer.result.totalScore} pontos</small>
          </div>
        )}
        {state.error && <span role="alert">{state.error}</span>}
      </div>
    </>
  );
}
