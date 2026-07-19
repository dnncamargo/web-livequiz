import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import type { QuizDetail } from "../../shared/quiz";
import { getQuizDetail, QuizLibraryRequestError } from "./quiz-library";

interface QuizDetailState {
  quiz: QuizDetail | null;
  loading: boolean;
  error: string | null;
}

interface ScopedQuizDetailState extends QuizDetailState {
  requestKey: string;
}

export function useQuizDetail(
  user: User | null,
  quizId: string,
  refreshRevision = 0,
): QuizDetailState {
  const requestKey = `${user?.uid ?? "signed-out"}:${quizId}`;
  const [state, setState] = useState<ScopedQuizDetailState>({
    requestKey: "",
    quiz: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!user || !quizId) return;

    let active = true;

    void getQuizDetail(user, quizId)
      .then((quiz) => {
        if (active) {
          setState({ requestKey, quiz, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        console.error("Erro ao carregar quiz para edição:", error);

        if (active) {
          setState({
            requestKey,
            quiz: null,
            loading: false,
            error:
              error instanceof QuizLibraryRequestError
                ? error.message
                : "Não foi possível carregar o quiz.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [quizId, refreshRevision, requestKey, user]);

  if (!user || !quizId) {
    return { quiz: null, loading: false, error: null };
  }

  if (state.requestKey !== requestKey) {
    return { quiz: null, loading: true, error: null };
  }

  return state;
}
