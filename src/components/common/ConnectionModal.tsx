import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Key,
  Layers,
  X,
} from 'lucide-react';
import {
  checkSupabaseHealth,
  reconfigureSupabase,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from '../../services/supabase';
import { seedInitialDatabaseIfEmpty } from '../../services/settingsService';
import { BIKIE_MIGRATION_SQL } from '../../data/migrationSql';
import { useRealtime } from '../../context/RealtimeContext';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({ isOpen, onClose }) => {
  const [url, setUrl] = useState(SUPABASE_URL);
  const [key, setKey] = useState(SUPABASE_ANON_KEY);
  const [healthStatus, setHealthStatus] = useState<{
    connected: boolean;
    message: string;
    tablesFound?: boolean;
  } | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
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
    } finally {
      setIsChecking(false);
    }
  };

  const handleSaveCredentials = () => {
    reconfigureSupabase(url.trim(), key.trim());
    handleTestConnection();
    triggerGlobalRefresh();
    alert('Credenciales actualizadas. Probando conexión...');
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(BIKIE_MIGRATION_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    setSeedResult(null);
    try {
      const res = await seedInitialDatabaseIfEmpty();
      setSeedResult(res.message);
      triggerGlobalRefresh();
      handleTestConnection();
    } catch (err: any) {
      setSeedResult(`Error: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#0d0d0d] rounded-sm max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-white/10 text-white relative my-8 animate-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 rounded-xs transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
          <div className="w-12 h-12 rounded-xs bg-[#ff3e00] text-black flex items-center justify-center accent-glow">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white font-display uppercase tracking-tight">
              CONEXIÓN & ESTADO SUPABASE
            </h2>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
              ÚNICA FUENTE DE VERDAD (SSOT) • POSTGRESQL + REALTIME
            </p>
          </div>
        </div>

        {/* Status Alert Banner */}
        <div
          className={`p-4 rounded-xs mb-6 flex items-start gap-3 border ${
            healthStatus?.connected
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
          }`}
        >
          {healthStatus?.connected ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs">
            <div className="font-bold flex items-center justify-between font-mono">
              <span className="uppercase tracking-wider">
                {healthStatus?.connected
                  ? 'BASE DE DATOS CONECTADA Y OPERATIVA'
                  : 'VERIFICANDO TABLAS / CONEXIÓN'}
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-xs bg-black/50 border border-white/10 uppercase tracking-wider">
                Realtime: {status}
              </span>
            </div>
            <p className="text-[11px] mt-1 opacity-90 font-mono">
              {healthStatus?.message || 'Comprobando estado del cluster...'}
            </p>
          </div>
          <button
            onClick={handleTestConnection}
            disabled={isChecking}
            className="p-2 bg-white/10 rounded-xs border border-white/10 text-white hover:bg-white/20 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            REINTENTAR
          </button>
        </div>

        {/* Vercel Environment Configuration Box */}
        <div className="p-4 rounded-xs bg-[#121212] border border-white/10 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
              VARIABLES DE ENTORNO PARA VERCEL
            </h4>
            <span className="text-[10px] font-mono text-white/40 uppercase">Settings &gt; Environment Variables</span>
          </div>
          <p className="text-[11px] text-white/60">
            Para conectar Supabase y la IA en Vercel, agrega estas 3 variables en tu panel de Vercel y haz un <strong>Redeploy</strong>:
          </p>
          <div className="space-y-2 font-mono text-[11px]">
            <div className="flex items-center justify-between p-2 bg-[#0a0a0a] rounded border border-white/10">
              <div>
                <span className="text-[#ef4444] font-bold">VITE_SUPABASE_URL</span>
                <span className="text-white/40 block text-[10px]">URL de tu proyecto de Supabase (https://xxx.supabase.co)</span>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText('VITE_SUPABASE_URL')}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] cursor-pointer"
                title="Copiar nombre de variable"
              >
                Copiar
              </button>
            </div>
            <div className="flex items-center justify-between p-2 bg-[#0a0a0a] rounded border border-white/10">
              <div>
                <span className="text-[#ef4444] font-bold">VITE_SUPABASE_ANON_KEY</span>
                <span className="text-white/40 block text-[10px]">Anon Public Key de Supabase (Project Settings &gt; API)</span>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText('VITE_SUPABASE_ANON_KEY')}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] cursor-pointer"
                title="Copiar nombre de variable"
              >
                Copiar
              </button>
            </div>
            <div className="flex items-center justify-between p-2 bg-[#0a0a0a] rounded border border-white/10">
              <div>
                <span className="text-[#ef4444] font-bold">GEMINI_API_KEY</span>
                <span className="text-white/40 block text-[10px]">API Key de Google Gemini para escanear listas escolares con IA</span>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText('GEMINI_API_KEY')}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] cursor-pointer"
                title="Copiar nombre de variable"
              >
                Copiar
              </button>
            </div>
          </div>
        </div>

        {/* 3 Quick Action Steps */}
        <div className="space-y-4 mb-6">
          <h3 className="text-xs font-black text-white/50 uppercase tracking-[0.2em] font-mono">
            PASOS DE INICIALIZACIÓN
          </h3>

          {/* Step 1: SQL Migration */}
          <div className="p-4 rounded-xs bg-[#141414] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-white uppercase tracking-wider">
                1. EJECUTAR SCRIPT SQL EN SUPABASE
              </p>
              <p className="text-[11px] text-white/40 mt-0.5">
                Copia el script con tablas, RLS, Realtime y RPC atómicos para pegarlo en SQL Editor.
              </p>
            </div>
            <button
              onClick={handleCopySql}
              className="w-full sm:w-auto px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[11px] font-black uppercase tracking-wider rounded-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {copiedSql ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>¡SQL COPIADO!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>COPIAR SQL MIGRACIÓN</span>
                </>
              )}
            </button>
          </div>

          {/* Step 2: Auto-Seed Initial Stationery Data */}
          <div className="p-4 rounded-xs bg-[#141414] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-white uppercase tracking-wider">
                2. POBLAR CATÁLOGO INICIAL BIKIE
              </p>
              <p className="text-[11px] text-white/40 mt-0.5">
                Inserta automáticamente categorías, útiles escolares, papelería técnica y promociones.
              </p>
            </div>
            <button
              onClick={handleSeedDatabase}
              disabled={isSeeding}
              className="w-full sm:w-auto px-4 py-2 bg-[#ff3e00] hover:bg-[#ff5522] text-black text-[11px] font-black uppercase tracking-wider rounded-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all disabled:opacity-50 accent-glow"
            >
              <Sparkles className={`w-4 h-4 ${isSeeding ? 'animate-spin' : ''}`} />
              <span>{isSeeding ? 'CARGANDO...' : 'POBLAR CATÁLOGO'}</span>
            </button>
          </div>

          {seedResult && (
            <div className="p-3 bg-[#171717] border border-white/10 rounded-xs text-xs text-white/70 font-mono">
              {seedResult}
            </div>
          )}
        </div>

        {/* Manual Credentials Box */}
        <div className="border-t border-white/10 pt-4">
          <details className="text-xs text-white/60 cursor-pointer">
            <summary className="font-bold text-white/70 hover:text-[#ff3e00] transition-colors uppercase tracking-wider font-mono">
              [+] Modificar URL y API Key de Supabase manualmente
            </summary>
            <div className="mt-3 space-y-3 p-3 bg-[#141414] rounded-xs border border-white/10">
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 font-mono">
                  SUPABASE_URL
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0d0d0d] border border-white/10 rounded-xs text-white focus:border-[#ff3e00] focus:outline-hidden font-mono"
                  placeholder="https://xyzcompany.supabase.co"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 font-mono">
                  SUPABASE_ANON_KEY
                </label>
                <input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0d0d0d] border border-white/10 rounded-xs text-white focus:border-[#ff3e00] focus:outline-hidden font-mono"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                />
              </div>
              <button
                onClick={handleSaveCredentials}
                className="px-4 py-2 bg-[#ff3e00] text-black rounded-xs text-xs font-black uppercase tracking-wider hover:bg-[#ff5522] cursor-pointer accent-glow"
              >
                GUARDAR Y CONECTAR
              </button>
            </div>
          </details>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xs text-xs font-black uppercase tracking-wider cursor-pointer transition-colors"
          >
            CERRAR TERMINAL
          </button>
        </div>
      </div>
    </div>
  );
};
