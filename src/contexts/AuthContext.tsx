import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { auth } from "../lib/firebase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAnonymous: boolean;
  signInParticipant: () => Promise<User>;
  signInAdministrator: () => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInParticipant = useCallback(async () => {
    if (auth.currentUser) {
      return auth.currentUser;
    }

    const credential = await signInAnonymously(auth);

    return credential.user;
  }, []);

  const signInAdministrator = useCallback(async () => {
    const provider = new GoogleAuthProvider();

    provider.setCustomParameters({
      prompt: "select_account",
    });

    const credential = await signInWithPopup(auth, provider);

    return credential.user;
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAnonymous: user?.isAnonymous ?? false,
      signInParticipant,
      signInAdministrator,
      logout,
    }),
    [
      user,
      loading,
      signInParticipant,
      signInAdministrator,
      logout,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth deve ser utilizado dentro de um AuthProvider.",
    );
  }

  return context;
}