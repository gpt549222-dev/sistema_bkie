import { supabase, isTableMissingError } from './supabase';
import { CashShift, CashMovement } from '../types';

export interface ShiftSummary {
  shift: CashShift;
  initialAmount: number;
  cashSalesTotal: number;
  depositsTotal: number;
  withdrawalsTotal: number;
  expectedAmount: number;
  finalCountedAmount: number | null;
  difference: number | null;
}

export async function getActiveCashShift(): Promise<CashShift | null> {
  const { data, error } = await supabase
    .from('cash_shifts')
    .select('*')
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isTableMissingError(error)) {
      console.warn("Tabla 'public.cash_shifts' no encontrada. Ejecuta MODIF_DB.sql en Supabase.");
      return null;
    }
    throw new Error(`Error al obtener turno de caja activo: ${error.message}`);
  }

  if (!data) return null;

  return {
    ...data,
    initial_amount: Number(data.initial_amount) || 0,
    final_amount: data.final_amount !== null ? Number(data.final_amount) : null,
    total_sales: Number(data.total_sales) || 0,
  };
}

export async function getCashShifts(): Promise<CashShift[]> {
  const { data, error } = await supabase
    .from('cash_shifts')
    .select('*')
    .order('opened_at', { ascending: false })
    .limit(50);

  if (error) {
    if (isTableMissingError(error)) return [];
    throw new Error(`Error al obtener historial de turnos de caja: ${error.message}`);
  }

  return (data || []).map((s: any) => ({
    ...s,
    initial_amount: Number(s.initial_amount) || 0,
    final_amount: s.final_amount !== null ? Number(s.final_amount) : null,
    total_sales: Number(s.total_sales) || 0,
  }));
}

export async function openCashShift(
  initialAmount: number,
  cashierName = 'Cajero BIKIE',
  notes?: string
): Promise<CashShift> {
  if (initialAmount < 0) {
    throw new Error('El monto de apertura de caja no puede ser negativo.');
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('open_cash_shift_atomic', {
    p_initial_amount: initialAmount,
    p_opened_by: cashierName,
    p_notes: notes || null,
  });

  if (rpcError) {
    console.error('[cashService] Error en RPC open_cash_shift_atomic:', rpcError);
    throw new Error(rpcError.message || 'Error al abrir turno de caja en el servidor.');
  }

  if (!rpcData?.id) {
    throw new Error('No se pudo confirmar la apertura del turno de caja en la base de datos.');
  }

  return {
    ...rpcData,
    initial_amount: Number(rpcData.initial_amount) || initialAmount,
    final_amount: null,
    total_sales: 0,
  };
}

export async function closeCashShift(
  shiftId: string,
  finalCountedAmount: number,
  notes?: string
): Promise<{
  shift: CashShift;
  expectedAmount: number;
  finalCountedAmount: number;
  difference: number;
}> {
  if (finalCountedAmount < 0) {
    throw new Error('El conteo físico de efectivo no puede ser negativo.');
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('close_cash_shift_atomic', {
    p_shift_id: shiftId,
    p_final_amount: finalCountedAmount,
    p_notes: notes || null,
  });

  if (rpcError) {
    console.error('[cashService] Error en RPC close_cash_shift_atomic:', rpcError);
    throw new Error(rpcError.message || 'Error al realizar el arqueo y cierre de caja.');
  }

  if (!rpcData?.success || !rpcData?.shift) {
    throw new Error('No se pudo completar el arqueo de caja en el servidor.');
  }

  return {
    shift: rpcData.shift,
    expectedAmount: Number(rpcData.expected_amount) || finalCountedAmount,
    finalCountedAmount,
    difference: Number(rpcData.difference) || 0,
  };
}

export async function getCashMovements(shiftId?: string): Promise<CashMovement[]> {
  let query = supabase
    .from('cash_movements')
    .select('*')
    .order('created_at', { ascending: false });

  if (shiftId) {
    query = query.eq('cash_register_id', shiftId);
  }

  const { data, error } = await query;
  if (error) {
    if (isTableMissingError(error)) return [];
    throw new Error(`Error al obtener movimientos de caja: ${error.message}`);
  }

  return (data || []).map((m: any) => ({
    ...m,
    amount: Number(m.amount) || 0,
  }));
}

export async function registerCashMovement(payload: {
  shiftId: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  description: string;
}): Promise<CashMovement> {
  if (payload.amount <= 0) {
    throw new Error('El monto del movimiento debe ser mayor a cero.');
  }
  if (!payload.description?.trim()) {
    throw new Error('Debe especificar un motivo o concepto para el movimiento.');
  }

  const { data, error } = await supabase
    .from('cash_movements')
    .insert({
      cash_register_id: payload.shiftId,
      type: payload.type,
      amount: payload.amount,
      description: payload.description.trim(),
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Error al registrar movimiento: ${error?.message}`);
  }

  return {
    ...data,
    amount: Number(data.amount) || 0,
  };
}
