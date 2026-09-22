import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { solicitarCambioContrasena } from '@/lib/profileService';
import { toast } from '@/lib/toast';

// El botón de "Continuar con Google" está listo en AuthContext
// (signInWithGoogle) pero oculto acá hasta que se habilite el proveedor
// Google en Supabase — ver docs/MEJORAS_PENDIENTES.md.

type Mode = 'signIn' | 'signUp' | 'forgotPassword';

export function Login() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enviandoRecuperacion, setEnviandoRecuperacion] = useState(false);
  const [recuperacionEnviada, setRecuperacionEnviada] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const cambiarModo = (nuevoModo: Mode) => {
    setMode(nuevoModo);
    setError(null);
    setRecuperacionEnviada(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signUp') {
        await signUp(email, password, fullName);
      } else {
        await signIn(email, password);
      }
      // El useEffect navega cuando "user" se actualice en el AuthContext.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Ingresá tu correo para enviarte el enlace.');
      return;
    }
    setError(null);
    setEnviandoRecuperacion(true);
    try {
      await solicitarCambioContrasena(email.trim());
      setRecuperacionEnviada(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo enviar el enlace';
      setError(msg);
      toast.error('No se pudo enviar el enlace', msg);
    } finally {
      setEnviandoRecuperacion(false);
    }
  };

  if (mode === 'forgotPassword') {
    return (
      <div className="max-w-md mx-auto mt-10 sm:mt-16 px-4 sm:px-6 lg:px-8 py-6">
        <button
          type="button"
          onClick={() => cambiarModo('signIn')}
          className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a iniciar sesión
        </button>

        <h1 className="mb-2 text-2xl font-bold text-cobalt">Recuperar contraseña</h1>

        {recuperacionEnviada ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Si <span className="font-medium">{email}</span> tiene una cuenta, te enviamos un enlace
            para restablecer la contraseña. Revisá tu correo (y la carpeta de spam).
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-500">
              Ingresá tu correo y te enviamos un enlace para elegir una nueva contraseña.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Input
                type="email"
                label="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
              />
              <Button type="submit" disabled={enviandoRecuperacion} className="w-full">
                {enviandoRecuperacion ? 'Enviando...' : 'Enviar enlace'}
              </Button>
            </form>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 sm:mt-16 px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="mb-1 text-2xl font-bold text-cobalt">
        {mode === 'signIn' ? 'Iniciar sesión' : 'Crear cuenta'}
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        {mode === 'signIn'
          ? 'Ingresá a tu cuenta de Easy CUSTOMS.'
          : 'Creá tu cuenta para empezar a importar con Easy CUSTOMS.'}
      </p>

      <div className="mb-6 flex overflow-hidden rounded-xl border border-slate-200">
        <button
          type="button"
          onClick={() => cambiarModo('signIn')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            mode === 'signIn' ? 'bg-cobalt text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => cambiarModo('signUp')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            mode === 'signUp' ? 'bg-cobalt text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Crear cuenta
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-500">{error}</p>}

        {mode === 'signUp' && (
          <Input
            type="text"
            label="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ej: Juan Pérez"
            required
          />
        )}

        <Input
          type="email"
          label="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          required
        />

        <div>
          <PasswordInput
            label="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signUp' ? 'Mínimo 6 caracteres' : '••••••••'}
            required
            minLength={6}
          />
          {mode === 'signIn' && (
            <button
              type="button"
              onClick={() => cambiarModo('forgotPassword')}
              className="mt-1.5 text-xs font-medium text-cobalt hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading
            ? mode === 'signIn'
              ? 'Ingresando...'
              : 'Creando cuenta...'
            : mode === 'signIn'
              ? 'Iniciar sesión'
              : 'Crear cuenta'}
        </Button>
      </form>
    </div>
  );
}
