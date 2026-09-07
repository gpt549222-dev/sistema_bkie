import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X, ShieldAlert } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  warningNote?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  requireKeyword?: string; // e.g. 'ELIMINAR'
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  warningNote = 'Esta acción puede ser irreversible.',
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  isDestructive = true,
  requireKeyword,
  isLoading = false,
}) => {
  const [typedKeyword, setTypedKeyword] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTypedKeyword('');
      setIsExecuting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmedAllowed = requireKeyword
    ? typedKeyword.trim().toUpperCase() === requireKeyword.toUpperCase()
    : true;

  const handleConfirm = async () => {
    if (!isConfirmedAllowed || isExecuting || isLoading) return;
    setIsExecuting(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // Error handled by caller
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-mono">
      <div className="bg-[#0d0d0d] border border-white/15 rounded-xl max-w-md w-full p-6 shadow-2xl text-white relative animate-in zoom-in-95">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isExecuting || isLoading}
          className="absolute top-4 right-4 p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-start gap-3.5 mb-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDestructive
                ? 'bg-red-600/20 text-[#ef4444] border border-red-500/30'
                : 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isDestructive ? (
              <Trash2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-white font-display">
              {title}
            </h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mt-0.5">
              CONFIRMACIÓN DE OPERACIÓN
            </p>
          </div>
        </div>

        {/* Body Message */}
        <div className="space-y-3 mb-5">
          <p className="text-xs text-white/80 leading-relaxed font-sans">
            {message}
          </p>

          {warningNote && (
            <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-900/50 flex items-center gap-2 text-[11px] text-[#ef4444] font-medium">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{warningNote}</span>
            </div>
          )}

          {requireKeyword && (
            <div className="pt-2">
              <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1.5">
                Para confirmar, escribe{' '}
                <span className="text-[#ef4444] font-black underline">
                  {requireKeyword}
                </span>{' '}
                a continuación:
              </label>
              <input
                type="text"
                autoFocus
                value={typedKeyword}
                onChange={(e) => setTypedKeyword(e.target.value)}
                placeholder={requireKeyword}
                className="w-full px-3 py-2 bg-[#141414] border border-white/20 rounded-lg text-xs font-mono text-white tracking-widest uppercase placeholder:text-white/20 focus:outline-hidden focus:border-[#dc2626]"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting || isLoading}
            className="px-4 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] border border-white/10 text-white/70 hover:text-white text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmedAllowed || isExecuting || isLoading}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              isConfirmedAllowed
                ? isDestructive
                  ? 'bg-[#dc2626] hover:bg-[#ef4444] text-white shadow-lg accent-glow'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-white/5 text-white/30 border border-white/5 cursor-not-allowed'
            }`}
          >
            {isExecuting || isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>PROCESANDO...</span>
              </>
            ) : (
              <>
                {isDestructive && <Trash2 className="w-3.5 h-3.5" />}
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
