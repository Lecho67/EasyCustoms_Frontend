// src/context/AuthContext.tsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { registrarSesion, sesionSigueVigente } from '../lib/sessionService';
import type { Profile } from '../types/database.types';
import { AuthContext } from './auth';

// El objeto de contexto y el hook `useAuth` viven fuera de este archivo
// (`./auth` y `@/hooks/useAuth`) para no romper su fast-refresh.

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Cada llamada a fetchProfile toma un id; si llega una más nueva (login/logout
  // rápido), las respuestas viejas se descartan para no pisar el estado actual.
  const requestIdRef = useRef(0);

  // Verdadero mientras `signIn` toma el control de la cuenta (registrarSesion):
  // onAuthStateChange dispara antes de que termine, y en esa ventana la base
  // todavía tiene registrada la sesión anterior — verificar entonces expulsaría
  // al login recién hecho.
  const registrandoSesionRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string, intentos = 3) => {
    const reqId = ++requestIdRef.current;

    for (let intento = 1; intento <= intentos; intento++) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (reqId !== requestIdRef.current) return; // respuesta obsoleta

      if (!error) {
        setProfile(data as Profile);
        setProfileError(null);
        return;
      }

      // PGRST116 = 0 filas: es un estado real, no un fallo transitorio
      if (error.code === 'PGRST116') {
        setProfile(null);
        setProfileError(error.message);
        return;
      }

      if (intento < intentos) {
        await new Promise((r) => setTimeout(r, 500 * intento));
        continue;
      }

      console.error('Error al cargar perfil:', error.message);
      setProfileError(error.message);
      toast.error(
        'No pudimos cargar tu perfil',
        'Revisá tu conexión y reintentá; no cerramos tu sesión.'
      );
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        requestIdRef.current++; // descarta cualquier fetchProfile en vuelo
        setProfile(null);
        setProfileError(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Realtime: refleja en vivo los cambios sobre el propio perfil del usuario
  // (aprobación/rechazo de KYC, cambio de rol, asignación de gestor) sin recargar.
  // Requiere que la tabla `profiles` esté en la publicación `supabase_realtime`.
  // Si Realtime no está habilitado, simplemente no dispara (degradación limpia).
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`perfil:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => {
          fetchProfile(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchProfile]);

  // Sesión única por cuenta ("la última gana"): si otro dispositivo inicia
  // sesión, `registrar_sesion()` revoca ésta y acá nos enteramos por Realtime
  // sobre `sesiones_activas`, al volver el foco a la pestaña, o en <60 s por
  // polling. Ver docs/sql/limites-de-uso.sql.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;

    let cerrando = false;
    const verificar = async () => {
      if (cerrando || registrandoSesionRef.current) return;
      const vigente = await sesionSigueVigente();
      if (vigente || cerrando || registrandoSesionRef.current) return;
      cerrando = true;
      // scope "local": el signOut global revocaría también la sesión nueva.
      await supabase.auth.signOut({ scope: 'local' });
      toast.info(
        'Tu sesión se cerró',
        'Iniciaste sesión con esta cuenta en otro dispositivo.'
      );
    };

    verificar();
    const intervalo = setInterval(verificar, 60_000);
    window.addEventListener('focus', verificar);
    const channel = supabase
      .channel(`sesion:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sesiones_activas', filter: `user_id=eq.${userId}` },
        verificar
      )
      .subscribe();

    return () => {
      clearInterval(intervalo);
      window.removeEventListener('focus', verificar);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName ?? '' } },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    registrandoSesionRef.current = true;
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await registrarSesion();
    } finally {
      registrandoSesionRef.current = false;
    }
  };

  // Redirige a Google y vuelve a /dashboard; la sesión la recoge
  // automáticamente el listener de arriba (detectSessionInUrl en supabase.ts).
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        profileError,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}