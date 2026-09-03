import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Layers,
  X,
  FileCode,
} from 'lucide-react';
import {
  checkSupabaseHealth,
  SUPABASE_URL,
} from '../../services/supabase';
import { BIKIE_MIGRATION_SQL } from '../../data/migrationSql';
import { useRealtime } from '../../context/RealtimeContext';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({ isOpen, onClose }) => {
  const [healthStatus, setHealthStatus] = useState<{
    connected: boolean;
    message: string;
    tablesFound?: boolean;
  } | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const { status, triggerGlobalRefresh } = useRealtime();

  useEffect(() => {
    if (isOpen) {
      handleTestConnection();
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
    setIsChecking(true);
    try {
      const res = await checkSupabaseHealth();
      setHealthStatus(res);
      triggerGlobalRefresh();
    } finally {
      setIsChecking(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(BIKIE_MIGRATION_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  if (!isOpen) return null;

  const isFullyOperational = healthStatus?.connected && healthStatus?.tablesFound;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#0d0d0d] rounded-xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-white/10 text-white relative my-8 animate-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/10">
          <div className="w-10 h-10 rounded-lg bg-[#dc2626] text-white flex items-center justify-center shadow-md font-display font-black text-lg">
            B
          </div>
          <div>
            <h2 className="text-lg font-black text-white font-display uppercase tracking-tight">
              ESTADO DE CONEXIÓN SUPABASE
            </h2>
            <p className="text-[11px] text-white/40 font-mono">
              BIKIE PAPELERÍA • PRODUCCIÓN VERCEL + SUPABASE
            </p>
          </div>
        </div>

        {/* Health Status Box */}
        <div
          className={`p-4 rounded-xl border mb-6 flex items-start gap-3 ${
            isFullyOperational
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : healthStatus?.connected
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {isFullyOperational ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider font-mono">
                {isFullyOperational
                  ? 'BASE DE DATOS OPERACIONAL (SUPABASE)'
                  : healthStatus?.connected
                  ? 'CONECTADO PERO REQUIERE APLICAR MODIF_DB.sql'
                  : 'CONFIGURACIÓN DE ENTORNO PENDIENTE'}
              </span>
              <button
                onClick={handleTestConnection}
                disabled={isChecking}
                className="text-[10px] underline hover:no-underline font-mono cursor-pointer flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
                <span>Reintentar</span>
              </button>
            </div>
            <p className="text-xs text-white/80 mt-1">
              {healthStatus?.message || 'Comprobando conexión a Supabase...'}
            </p>
            {SUPABASE_URL && (
              <p className="text-[10px] text-white/40 font-mono mt-1 truncate">
                Servidor: {SUPABASE_URL}
              </p>
            )}
          </div>
        </div>

        {/* Realtime Status Indicator */}
        <div className="grid grid-cols-2 gap-3 mb-6 font-mono">
          <div className="p-3 bg-[#141414] border border-white/10 rounded-xl flex items-center gap-2.5">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                status.connected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-amber-500'
              }`}
            />
            <div>
              <p className="text-[10px] text-white/40 uppercase">Supabase Realtime</p>
              <p className="text-xs font-bold text-white uppercase">
                {status.connected ? 'Activo y Sincronizado' : 'Conectando canal...'}
              </p>
            </div>
          </div>
          <div className="p-3 bg-[#141414] border border-white/10 rounded-xl flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-[#ef4444]" />
            <div>
              <p className="text-[10px] text-white/40 uppercase">Tablas Supabase</p>
              <p className="text-xs font-bold text-white uppercase">
                {healthStatus?.tablesFound ? '19 Tablas Listas' : 'Pendientes de migrar'}
              </p>
            </div>
          </div>
        </div>

        {/* Required Vercel Environment Variables */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black text-white/60 uppercase tracking-widest font-mono">
              VARIABLES DE ENTORNO EN VERCEL
            </h3>
            <span className="text-[10px] text-white/40 font-mono">
              Project Settings &gt; Environment Variables
            </span>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between p-2.5 bg-[#141414] rounded-lg border border-white/10">
              <div>
                <span className="text-[#ef4444] font-bold">VITE_SUPABASE_URL</span>
                <span className="text-white/40 block text-[10px]">URL del proyecto en Supabase</span>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText('VITE_SUPABASE_URL')}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] cursor-pointer"
              >
                Copiar
              </button>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-[#141414] rounded-lg border border-white/10">
              <div>
                <span className="text-[#ef4444] font-bold">VITE_SUPABASE_ANON_KEY</span>
                <span className="text-white/40 block text-[10px]">Clave pública anon de Supabase</span>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText('VITE_SUPABASE_ANON_KEY')}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] cursor-pointer"
              >
                Copiar
              </button>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-[#141414] rounded-lg border border-white/10">
              <div>
                <span className="text-[#ef4444] font-bold">GEMINI_API_KEY</span>
                <span className="text-white/40 block text-[10px]">Clave Google Gemini para escanear listas con IA</span>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText('GEMINI_API_KEY')}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] cursor-pointer"
              >
                Copiar
              </button>
            </div>
          </div>
        </div>

        {/* Master Database Script Box */}
        <div className="p-4 rounded-xl bg-[#141414] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <p className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-[#ef4444]" />
              ARCHIVO DE BASE DE DATOS: MODIF_DB.sql
            </p>
            <p className="text-[11px] text-white/50 mt-0.5">
              Contiene todas las tablas, funciones atómicas FOR UPDATE, políticas RLS y Realtime.
            </p>
          </div>
          <button
            onClick={handleCopySql}
            className="w-full sm:w-auto px-4 py-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-[11px] font-black uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0"
          >
            {copiedSql ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>¡COPIADO!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>COPIAR MODIF_DB.sql</span>
              </>
            )}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer transition-colors"
          >
            CERRAR
          </button>
        </div>
      </div>
    </div>
  );
};
