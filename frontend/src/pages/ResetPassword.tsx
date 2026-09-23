import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { toast } from "@/lib/toast";

export function ResetPassword() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [readyForReset, setReadyForReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReadyForReset(true);
        setChecking(false);
      }
    });

    // Si el enlace de recuperación ya fue procesado por Supabase (detectSessionInUrl)
    // antes de montar el listener, confirmamos con la sesión activa.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReadyForReset(true);
      setChecking(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Contraseña actualizada correctamente");
      setTimeout(() => navigate("/perfil"), 1500);
    } catch (err) {
      toast.error("No se pudo actualizar la contraseña", err instanceof Error ? err.message : undefined);
    } finally {
      setIsLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="max-w-md mx-auto mt-16 sm:mt-24 px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        Verificando enlace...
      </div>
    );
  }

  if (!readyForReset) {
    return (
      <div className="max-w-md mx-auto mt-16 sm:mt-24 px-4 sm:px-6 lg:px-8 py-6 text-center">
        <h1 className="text-2xl font-bold text-cobalt mb-2">Enlace inválido o expirado</h1>
        <p className="text-slate-600 mb-6">
          Este enlace de restablecimiento de contraseña ya no es válido. Solicitá uno nuevo desde tu perfil
          o desde la pantalla de inicio de sesión.
        </p>
        <Button onClick={() => navigate("/login")}>Ir a iniciar sesión</Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 sm:mt-24 px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-2 flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-cobalt" />
        <h1 className="text-2xl font-bold text-cobalt">Restablecer contraseña</h1>
      </div>
      <p className="text-slate-600 mb-8">Ingresá tu nueva contraseña para completar el restablecimiento.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordInput
          label="Nueva contraseña"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          minLength={8}
          required
        />
        <PasswordInput
          label="Confirmar nueva contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repetí la contraseña"
          minLength={8}
          required
        />

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Actualizando..." : "Actualizar contraseña"}
        </Button>
      </form>
    </div>
  );
}