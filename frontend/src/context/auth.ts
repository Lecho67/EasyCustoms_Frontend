import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database.types";

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  /** Verdadero cuando esta sesión se cerró porque la cuenta inició sesión en
   * otro dispositivo (sesión única por cuenta); lo consume `SessionKickedModal`. */
  sesionDesplazada: boolean;
  descartarAvisoSesion: () => void;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// Objeto de contexto en su propio módulo para no romper el fast-refresh de
// `AuthContext.tsx` (que solo exporta el provider) ni de `hooks/useAuth.ts`.
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
