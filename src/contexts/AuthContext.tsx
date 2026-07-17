import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AuthContext, type AuthContextValue } from "./auth-context";
import {
  checkAdministratorAuthorization,
  signInAdministratorWithGoogle,
} from "../features/auth/administrator-auth";
import {
  getAdministratorAuthorizationErrorMessage,
  getAuthErrorMessage,
} from "../features/auth/auth-errors";
import { signInParticipantAnonymously } from "../features/auth/participant-auth";
import { auth } from "../lib/firebase";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [
    administratorAuthorizationStatus,
    setAdministratorAuthorizationStatus,
  ] =
    useState<AuthContextValue["administratorAuthorizationStatus"]>(
      "not-applicable",
    );
  const authorizationAttemptRef = useRef(0);

  const verifyAdministrator = useCallback(async (candidate: User) => {
    const attempt = authorizationAttemptRef.current + 1;
    authorizationAttemptRef.current = attempt;
    setAdministratorAuthorizationStatus("checking");
    setAuthErrorMessage(null);

    try {
      const result = await checkAdministratorAuthorization(candidate);

      if (authorizationAttemptRef.current !== attempt) {
        return;
      }

      setAdministratorAuthorizationStatus(
        result.authorized ? "authorized" : "unauthorized",
      );
    } catch (error) {
      if (authorizationAttemptRef.current !== attempt) {
        return;
      }

      console.error("Erro ao verificar autorização administrativa:", error);
      setAdministratorAuthorizationStatus("error");
      setAuthErrorMessage(getAdministratorAuthorizationErrorMessage(error));
    } finally {
      if (authorizationAttemptRef.current === attempt) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setAuthErrorMessage(null);

        if (!currentUser || currentUser.isAnonymous) {
          authorizationAttemptRef.current += 1;
          setAdministratorAuthorizationStatus("not-applicable");
          setLoading(false);
          return;
        }

        setLoading(true);
        void verifyAdministrator(currentUser);
      },
      (error) => {
        authorizationAttemptRef.current += 1;
        console.error("Erro ao restaurar a sessão do Firebase:", error);
        setUser(null);
        setAdministratorAuthorizationStatus("not-applicable");
        setAuthErrorMessage(
          getAuthErrorMessage(
            error,
            "Não foi possível restaurar sua sessão. Atualize a página e tente novamente.",
          ),
        );
        setLoading(false);
      },
    );

    return () => {
      authorizationAttemptRef.current += 1;
      unsubscribe();
    };
  }, [verifyAdministrator]);

  const signInParticipant = useCallback(async () => {
    return signInParticipantAnonymously();
  }, []);

  const signInAdministrator = useCallback(async () => {
    return signInAdministratorWithGoogle();
  }, []);

  const refreshAdministratorAuthorization = useCallback(async () => {
    const currentUser = auth.currentUser;

    if (!currentUser || currentUser.isAnonymous) {
      authorizationAttemptRef.current += 1;
      setAdministratorAuthorizationStatus("not-applicable");
      setLoading(false);
      return;
    }

    setLoading(true);
    await verifyAdministrator(currentUser);
  }, [verifyAdministrator]);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAnonymous: user?.isAnonymous ?? false,
      isAdministrator: administratorAuthorizationStatus === "authorized",
      administratorAuthorizationStatus,
      authErrorMessage,
      signInParticipant,
      signInAdministrator,
      refreshAdministratorAuthorization,
      logout,
    }),
    [
      user,
      loading,
      administratorAuthorizationStatus,
      authErrorMessage,
      signInParticipant,
      signInAdministrator,
      refreshAdministratorAuthorization,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
