import React, { useState } from 'react';
import { updateBusinessSettings } from '../../services/settingsService';
import { BusinessSettings } from '../../types';
import { useRealtime } from '../../context/RealtimeContext';
import { BIKIE_MIGRATION_SQL } from '../../data/migrationSql';
import {
  Building2,
  Phone,
  CreditCard,
  Database,
  Copy,
  Check,
  Save,
  Sparkles,
  MapPin,
  CheckCircle2,
} from 'lucide-react';

interface AdminSettingsProps {
  settings: BusinessSettings;
  onOpenConnection: () => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  settings,
  onOpenConnection,
}) => {
  const [formData, setFormData] = useState<BusinessSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { triggerGlobalRefresh } = useRealtime();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await updateBusinessSettings(formData);
      setSaveSuccess(true);
      triggerGlobalRefresh();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Error al guardar configuración: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(BIKIE_MIGRATION_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d0d0d] p-6 rounded-xl border border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight">
            CONFIGURACIÓN DEL NEGOCIO
          </h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
            DATOS FISCALES, CUENTAS DE COBRO, WHATSAPP Y ARQUITECTURA SUPABASE
          </p>
        </div>

        <button
          onClick={onOpenConnection}
          className="px-4 py-2 bg-[#141414] hover:bg-white/10 border border-white/10 text-white text-xs font-black uppercase tracking-wider rounded-lg flex items-center gap-2 cursor-pointer transition-all"
        >
          <Database className="w-4 h-4 text-[#ef4444]" />
          <span>GESTIÓN SUPABASE & TABLAS</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Business identity */}
        <div className="bg-[#0d0d0d] rounded-xl p-6 border border-white/10 space-y-4">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#ef4444]" />
            <span>DATOS FISCALES E IDENTIDAD COMERCIAL</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-black text-white/60 uppercase tracking-wider mb-1">NOMBRE COMERCIAL *</label>
              <input
                type="text"
                required
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white uppercase placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-black text-white/60 uppercase tracking-wider mb-1">RIF / IDENTIFICACIÓN FISCAL *</label>
              <input
                type="text"
                required
                value={formData.rif_tax_id}
                onChange={(e) => setFormData({ ...formData, rif_tax_id: e.target.value })}
                className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white font-mono uppercase placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-black text-white/60 uppercase tracking-wider mb-1">TELÉFONO PRINCIPAL / LOCAL</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white font-mono placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-black text-white/60 uppercase tracking-wider mb-1">WHATSAPP PARA PEDIDOS *</label>
              <input
                type="text"
                required
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white font-mono placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-black text-white/60 uppercase tracking-wider mb-1">DIRECCIÓN DEL LOCAL COMERCIAL</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white uppercase placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Payment Account Details */}
        <div className="bg-[#0d0d0d] rounded-xl p-6 border border-white/10 space-y-4">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>CUENTAS DE PAGO PARA CLIENTES</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-black text-white/60 uppercase tracking-wider mb-1">DATOS DE PAGO MÓVIL / AIRTEL / MTN MONEY</label>
              <textarea
                rows={2}
                value={formData.pago_movil_info}
                onChange={(e) => setFormData({ ...formData, pago_movil_info: e.target.value })}
                placeholder="Banco/Operador, Cédula/Identificación, Teléfono..."
                className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg font-mono text-[11px] text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-black text-white/60 uppercase tracking-wider mb-1">DATOS DE BINANCE PAY / CRIPTO</label>
              <textarea
                rows={2}
                value={formData.binance_info}
                onChange={(e) => setFormData({ ...formData, binance_info: e.target.value })}
                placeholder="Binance Pay ID / Correo / Billetera..."
                className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg font-mono text-[11px] text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-black text-white/60 uppercase tracking-wider mb-1">
                DATOS DE TRANSFERENCIA BANCARIA
              </label>
              <textarea
                rows={2}
                value={formData.bank_transfer_info}
                onChange={(e) => setFormData({ ...formData, bank_transfer_info: e.target.value })}
                placeholder="Banco, Número de Cuenta, Titular, RIF/NIF..."
                className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg font-mono text-[11px] text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2">
          {saveSuccess ? (
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              ¡CONFIGURACIÓN GUARDADA EN SUPABASE!
            </span>
          ) : (
            <span></span>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-[#dc2626] hover:bg-[#ef4444] text-white font-black uppercase tracking-wider rounded-lg text-xs flex items-center gap-2 accent-glow shadow-md cursor-pointer transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
