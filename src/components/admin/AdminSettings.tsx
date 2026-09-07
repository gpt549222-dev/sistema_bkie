import React, { useState, useEffect } from 'react';
import { updateBusinessSettings } from '../../services/settingsService';
import { BusinessSettings } from '../../types';
import { useRealtime } from '../../context/RealtimeContext';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  getSystemUsers,
  createSystemUser,
  deleteSystemUser,
  SystemUser,
} from '../../services/userService';
import {
  Building2,
  Phone,
  CreditCard,
  Save,
  MapPin,
  CheckCircle2,
  Users,
  UserPlus,
  Shield,
  Trash2,
  Database,
  Copy,
  Check,
  RefreshCw,
  KeyRound,
  X,
} from 'lucide-react';

interface AdminSettingsProps {
  settings: BusinessSettings;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  settings,
}) => {
  const [activeTab, setActiveTab] = useState<'business' | 'users' | 'database'>('business');
  const [formData, setFormData] = useState<BusinessSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { triggerGlobalRefresh } = useRealtime();

  // Gestión de usuarios
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SystemUser | null>(null);
  const [userFormData, setUserFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'cashier' as 'admin' | 'cashier' | 'customer',
    phone: '',
  });

  const [copiedSql, setCopiedSql] = useState(false);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await getSystemUsers();
      setUsers(data);
    } catch (err: any) {
      console.error('Error al cargar usuarios:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.email || !userFormData.password) {
      alert('Por favor ingresa correo y contraseña.');
      return;
    }
    if (userFormData.password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsCreatingUser(true);
    try {
      await createSystemUser(userFormData);
      alert(`Usuario ${userFormData.email} creado con éxito con rol [${userFormData.role.toUpperCase()}].`);
      setUserFormData({
        email: '',
        password: '',
        full_name: '',
        role: 'cashier',
        phone: '',
      });
      setIsNewUserModalOpen(false);
      loadUsers();
    } catch (err: any) {
      alert(`Error al crear usuario: ${err.message}`);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = (user: SystemUser) => {
    // Protección estricta: nunca permitir eliminar al único administrador
    if (user.role === 'admin') {
      const adminCount = users.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) {
        alert('OPERACIÓN BLOQUEADA: No se puede eliminar al único administrador del sistema. La plataforma requiere al menos un administrador activo.');
        return;
      }
    }
    setUserToDelete(user);
  };

  const handleExecuteDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteSystemUser(userToDelete.id);
      alert('Usuario eliminado con éxito.');
      setUserToDelete(null);
      loadUsers();
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

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

  const copySqlToClipboard = () => {
    const sqlText = `-- Archivo DATOS.sql generado para Supabase\n-- Ejecutar en Supabase -> SQL Editor\n-- Contiene las funciones para crear usuarios, depurar pedidos y facturas.`;
    navigator.clipboard.writeText(sqlText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
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
            DATOS FISCALES, USUARIOS DEL SISTEMA Y BASE DE DATOS
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-[#141414] p-1 rounded-lg border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('business')}
            className={`px-3 py-2 rounded-md text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'business'
                ? 'bg-[#dc2626] text-white shadow-xs'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>NEGOCIO</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-3 py-2 rounded-md text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'users'
                ? 'bg-[#dc2626] text-white shadow-xs'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>USUARIOS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('database')}
            className={`px-3 py-2 rounded-md text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'database'
                ? 'bg-[#dc2626] text-white shadow-xs'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>BD / SQL</span>
          </button>
        </div>
      </div>

      {/* TAB 1: DATOS DEL NEGOCIO */}
      {activeTab === 'business' && (
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
                ¡CONFIGURACIÓN GUARDADA EXITOSAMENTE!
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
      )}

      {/* TAB 2: GESTIÓN DE USUARIOS */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-[#0d0d0d] rounded-xl p-6 border border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#ef4444]" />
                  <span>USUARIOS Y ROLES DEL SISTEMA</span>
                </h3>
                <p className="text-[10px] text-white/40 uppercase mt-0.5">
                  ADMINISTRA ACCESOS PARA CAJEROS, ADMINISTRADORES Y CLIENTES
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadUsers}
                  disabled={isLoadingUsers}
                  className="p-2.5 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors cursor-pointer"
                  title="Recargar usuarios"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingUsers ? 'animate-spin text-[#ef4444]' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(true)}
                  className="px-4 py-2.5 bg-[#dc2626] hover:bg-[#ef4444] text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 accent-glow shadow-md cursor-pointer transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>NUEVO USUARIO</span>
                </button>
              </div>
            </div>

            {/* Users Table */}
            {isLoadingUsers ? (
              <div className="py-12 text-center text-white/40 uppercase tracking-widest text-xs">
                Cargando usuarios...
              </div>
            ) : users.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-white/10 rounded-lg">
                <Users className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="text-white/40 text-xs uppercase">No se encontraron usuarios registrados.</p>
                <button
                  onClick={() => setIsNewUserModalOpen(true)}
                  className="mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-black uppercase"
                >
                  Crear primer usuario
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40 uppercase text-[10px] font-mono">
                      <th className="pb-3 font-medium">USUARIO / NOMBRE</th>
                      <th className="pb-3 font-medium">CORREO / TELÉFONO</th>
                      <th className="pb-3 font-medium">ROL ASIGNADO</th>
                      <th className="pb-3 font-medium text-right">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map((u) => {
                      const roleBadge = {
                        admin: 'bg-red-500/20 border-red-500/30 text-[#ef4444]',
                        cashier: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
                        customer: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
                      }[u.role] || 'bg-white/10 border-white/20 text-white';

                      const roleLabel = {
                        admin: 'ADMINISTRADOR',
                        cashier: 'CAJERO (POS)',
                        customer: 'CLIENTE',
                      }[u.role] || u.role;

                      return (
                        <tr key={u.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-white text-xs">
                                {(u.full_name || u.email || 'U')[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-white uppercase">{u.full_name || 'Sin nombre'}</p>
                                <p className="text-[10px] text-white/40 font-mono">ID: {u.id.slice(0, 8)}...</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 font-mono">
                            <p className="text-white/90">{u.email}</p>
                            {u.phone && <p className="text-[10px] text-white/40">{u.phone}</p>}
                          </td>
                          <td className="py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-[10px] font-black uppercase tracking-wider ${roleBadge}`}>
                              <Shield className="w-3 h-3" />
                              {roleLabel}
                            </span>
                          </td>
                          <td className="py-3.5 text-right">
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-[#ef4444] rounded-lg transition-colors cursor-pointer"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BASE DE DATOS Y MIGRACIÓN */}
      {activeTab === 'database' && (
        <div className="bg-[#0d0d0d] rounded-xl p-6 border border-white/10 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-[#ef4444]" />
                <span>ARCHIVO DE BASE DE DATOS (DATOS.sql)</span>
              </h3>
              <p className="text-[10px] text-white/40 uppercase mt-0.5">
                ESTRUCTURAS, PERMISOS RPC Y FUNCIONES DE MIGRACIÓN PARA SUPABASE
              </p>
            </div>

            <button
              onClick={copySqlToClipboard}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? '¡COPIADO!' : 'COPIAR INSTRUCCIONES'}</span>
            </button>
          </div>

          <div className="p-4 bg-[#141414] border border-white/10 rounded-lg space-y-3 text-xs">
            <p className="text-white/80 font-bold uppercase text-emerald-400">
              ✓ Archivo <span className="font-mono underline">DATOS.sql</span> generado en la raíz del proyecto.
            </p>
            <p className="text-white/60">
              Contiene todas las funciones necesarias para crear usuarios con contraseñas encriptadas,
              depuración y borrado seguro en cascada de pedidos y facturas.
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-white/70 text-[11px]">
              <li>Abre tu consola de proyecto en Supabase (<span className="text-[#ef4444]">supabase.com/dashboard</span>).</li>
              <li>Entra en la sección lateral <strong>SQL Editor</strong>.</li>
              <li>Abre o copia el contenido del archivo <strong>DATOS.sql</strong> y presiona <strong>RUN</strong>.</li>
              <li>Las funciones quedarán activadas de inmediato.</li>
            </ol>
          </div>
        </div>
      )}

      {/* Modal Crear Nuevo Usuario */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#0d0d0d] rounded-xl max-w-md w-full p-6 border border-white/10 shadow-2xl relative text-white animate-in fade-in zoom-in-95 font-mono">
            <button
              onClick={() => setIsNewUserModalOpen(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-[#dc2626]/20 border border-[#dc2626]/30 flex items-center justify-center text-[#ef4444]">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-lg text-white uppercase tracking-tight">
                  CREAR NUEVO USUARIO
                </h3>
                <p className="text-[10px] text-white/40 uppercase">
                  Acceso al sistema y asignación de rol
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">
                  NOMBRE COMPLETO *
                </label>
                <input
                  type="text"
                  required
                  value={userFormData.full_name}
                  onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                  placeholder="Ej: Carlos Gómez"
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden uppercase"
                />
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">
                  CORREO ELECTRÓNICO *
                </label>
                <input
                  type="email"
                  required
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder="usuario@bikie.com"
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white font-mono placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">
                  CONTRASEÑA DE ACCESO *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white font-mono placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">
                  TELÉFONO / WHATSAPP
                </label>
                <input
                  type="text"
                  value={userFormData.phone}
                  onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                  placeholder="+58 412..."
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white font-mono placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">
                  ROL EN EL SISTEMA *
                </label>
                <select
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as any })}
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white font-mono uppercase focus:border-[#dc2626] focus:outline-hidden cursor-pointer"
                >
                  <option value="cashier">CAJERO / VENDEDOR (Acceso al Punto de Venta POS)</option>
                  <option value="admin">ADMINISTRADOR (Acceso Total al Sistema)</option>
                  <option value="customer">CLIENTE (Solo Catálogo y Pedidos)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="flex-1 py-2.5 bg-[#dc2626] hover:bg-[#ef4444] text-white text-xs font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer disabled:opacity-50 accent-glow"
                >
                  {isCreatingUser ? 'CREANDO...' : 'REGISTRAR USUARIO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ConfirmModal para eliminar usuario */}
      <ConfirmModal
        isOpen={Boolean(userToDelete)}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleExecuteDeleteUser}
        title="Eliminar Usuario"
        message={`¿Estás seguro de que deseas eliminar al usuario ${userToDelete?.email || userToDelete?.full_name}? Perderá inmediatamente el acceso al sistema.`}
        warningNote="Esta acción revocará las credenciales y el acceso a la cuenta."
        requireKeyword="ELIMINAR"
        confirmLabel="Eliminar Usuario"
      />
    </div>
  );
};
