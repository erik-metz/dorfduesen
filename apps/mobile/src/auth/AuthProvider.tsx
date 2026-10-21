import { createContext, useContext, useState, type PropsWithChildren } from 'react';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

type AuthContextValue = {
  status: AuthStatus;
  setStatus: (status: AuthStatus) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  // Mobile session restore and SecureStore integration are implemented with OAuth in step 3.
  const [status, setStatus] = useState<AuthStatus>('anonymous');
  return <AuthContext.Provider value={{ status, setStatus }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth muss innerhalb des AuthProvider verwendet werden.');
  return context;
}
