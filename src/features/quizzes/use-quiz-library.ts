import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import type { Quiz } from "../../shared/quiz";
import { listQuizLibrary, QuizLibraryRequestError } from "./quiz-library";

interface QuizLibraryState {
  quizzes: Quiz[];
  loading: boolean;
  error: string | null;
}

interface ScopedQuizLibraryState extends QuizLibraryState {
  ownerId: string;
}

export function useQuizLibrary(
  user: User | null,
  refreshRevision = 0,
): QuizLibraryState {
  const ownerId = user?.uid ?? "signed-out";
  const [state, setState] = useState<ScopedQuizLibraryState>({
    ownerId: "",
    quizzes: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!user) return;

    let active = true;

    void listQuizLibrary(user)
      .then((quizzes) => {
        if (active) {
          setState({ ownerId, quizzes, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        console.error("Erro ao carregar biblioteca de quizzes:", error);

        if (active) {
          setState({
            ownerId,
            quizzes: [],
            loading: false,
            error:
              error instanceof QuizLibraryRequestError
                ? error.message
                : "Não foi possível carregar seus quizzes.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [ownerId, refreshRevision, user]);

  if (!user) return { quizzes: [], loading: false, error: null };
  if (state.ownerId !== ownerId) {
    return { quizzes: [], loading: true, error: null };
  }

  return state;
}
