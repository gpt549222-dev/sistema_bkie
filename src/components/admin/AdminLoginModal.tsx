import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Lock,
  Mail,
  Key,
  X,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    return Number(sessionStorage.getItem('bikie_login_failed_attempts') || '0');
  });
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(() => {
    const lockedUntil = Number(sessionStorage.getItem('bikie_login_locked_until') || '0');
    const diff = Math.ceil((lockedUntil - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  });
  const { login, logout } = useAuth();

  // Timer countdown for lockout
  React.useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          sessionStorage.removeItem('bikie_login_locked_until');
          sessionStorage.removeItem('bikie_login_failed_attempts');
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0) {
      setErrorMessage(`Acceso temporalmente bloqueado por seguridad. Inténtalo de nuevo en ${lockoutRemaining} segundos.`);
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const role = await login(email.trim(), password);
      if (role !== 'admin') {
        await logout();
        throw new Error('Acceso denegado: Esta cuenta no tiene rol de administrador en Supabase.');
      }
      // Reset failed attempts on success
      sessionStorage.removeItem('bikie_login_failed_attempts');
      sessionStorage.removeItem('bikie_login_locked_until');
      setFailedAttempts(0);
      onSuccess();
      onClose();
    } catch (err: any) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      sessionStorage.setItem('bikie_login_failed_attempts', String(newAttempts));

      if (newAttempts >= 5) {
        const lockSeconds = 180; // 3 minutos
        const lockedUntil = Date.now() + lockSeconds * 1000;
        sessionStorage.setItem('bikie_login_locked_until', String(lockedUntil));
        setLockoutRemaining(lockSeconds);
        setErrorMessage(`Demasiados intentos fallidos (5). Por seguridad, el acceso ha sido bloqueado durante 3 minutos.`);
      } else {
        const remainingAttempts = 5 - newAttempts;
        setErrorMessage(`${err.message || 'Credenciales inválidas en Supabase Auth.'} (Intentos restantes: ${remainingAttempts})`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#0d0d0d] rounded-xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-white/10 text-white relative animate-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#dc2626] text-white flex items-center justify-center mx-auto mb-3 accent-glow shadow-md font-display font-black text-xl">
            B
          </div>
          <h2 className="text-2xl font-black text-white font-display uppercase tracking-tight">
            ACCESO ADMINISTRADOR
          </h2>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mt-1">
            BIKIE PAPELERÍA • AUTENTICACIÓN SUPABASE
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-[#ef4444] text-xs font-bold flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1 flex items-center gap-1.5 font-mono">
              <Mail className="w-3 h-3 text-[#ef4444]" />
              CORREO ELECTRÓNICO
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@bikie.com"
              className="w-full px-3.5 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:outline-hidden focus:border-[#dc2626] font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1 flex items-center gap-1.5 font-mono">
              <Key className="w-3 h-3 text-[#ef4444]" />
              CONTRASEÑA
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:outline-hidden focus:border-[#dc2626] font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || lockoutRemaining > 0}
            className="w-full py-3.5 bg-[#dc2626] hover:bg-[#ef4444] text-white font-black uppercase tracking-[0.2em] rounded-lg text-xs flex items-center justify-center gap-2 accent-glow shadow-md cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {lockoutRemaining > 0
                ? `BLOQUEADO (${lockoutRemaining}s)`
                : isLoading
                ? 'AUTENTICANDO...'
                : 'INICIAR SESIÓN'}
            </span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <p className="text-[10px] text-white/40 uppercase tracking-wider font-mono">
            Acceso seguro verificado mediante Supabase Auth y RLS
          </p>
        </div>
      </div>
    </div>
  );
};
