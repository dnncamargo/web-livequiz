import type { User } from "firebase/auth";
import { createContext, useContext } from "react";

export type AdministratorAuthorizationStatus =
  "not-applicable" | "checking" | "authorized" | "unauthorized" | "error";

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAnonymous: boolean;
  isAdministrator: boolean;
  administratorAuthorizationStatus: AdministratorAuthorizationStatus;
  authErrorMessage: string | null;
  signInParticipant: () => Promise<User>;
  signInAdministrator: () => Promise<User>;
  refreshAdministratorAuthorization: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider.");
  }

  return context;
}
