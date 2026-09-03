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
  const { login, logout } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const role = await login(email.trim(), password);
      if (role !== 'admin') {
        await logout();
        setErrorMessage('Acceso denegado: Esta cuenta no tiene rol de administrador en Supabase.');
        return;
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Credenciales inválidas en Supabase Auth.');
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
            disabled={isLoading}
            className="w-full py-3.5 bg-[#dc2626] hover:bg-[#ef4444] text-white font-black uppercase tracking-[0.2em] rounded-lg text-xs flex items-center justify-center gap-2 accent-glow shadow-md cursor-pointer transition-all disabled:opacity-50 mt-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isLoading ? 'AUTENTICANDO...' : 'INICIAR SESIÓN'}</span>
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
