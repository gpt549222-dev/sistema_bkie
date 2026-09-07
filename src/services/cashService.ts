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

  // 1. Intentar RPC atómico
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('open_cash_shift_atomic', {
      p_initial_amount: initialAmount,
      p_opened_by: cashierName,
      p_notes: notes || null,
    });

    if (!rpcError && rpcData?.id) {
      return {
        ...rpcData,
        initial_amount: Number(rpcData.initial_amount) || initialAmount,
        final_amount: null,
        total_sales: 0,
      };
    }
  } catch {}

  // 2. Inserción directa
  const { data, error } = await supabase
    .from('cash_shifts')
    .insert({
      opened_by: cashierName,
      initial_amount: initialAmount,
      total_sales: 0,
      status: 'open',
      notes: notes || 'Apertura de turno en caja',
      opened_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Error al abrir turno de caja: ${error?.message || 'Fallo de inserción'}`);
  }

  return {
    ...data,
    initial_amount: Number(data.initial_amount) || 0,
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

  // 1. Intentar RPC atómico
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('close_cash_shift_atomic', {
      p_shift_id: shiftId,
      p_final_amount: finalCountedAmount,
      p_notes: notes || null,
    });

    if (!rpcError && rpcData?.success) {
      return {
        shift: rpcData.shift,
        expectedAmount: Number(rpcData.expected_amount) || finalCountedAmount,
        finalCountedAmount,
        difference: Number(rpcData.difference) || 0,
      };
    }
  } catch {}

  // 2. Cálculo directo de arqueo
  const { data: shift, error: sErr } = await supabase
    .from('cash_shifts')
    .select('*')
    .eq('id', shiftId)
    .single();

  if (sErr || !shift) {
    throw new Error('No se encontró el turno de caja especificado.');
  }

  const initialAmount = Number(shift.initial_amount) || 0;
  const openedAt = shift.opened_at;
  const nowIso = new Date().toISOString();

  // Consultar ventas en efectivo durante este turno
  const { data: cashSales } = await supabase
    .from('sales')
    .select('total_amount')
    .eq('payment_method', 'efectivo')
    .gte('created_at', openedAt)
    .lte('created_at', nowIso);

  const cashSalesTotal = (cashSales || []).reduce(
    (sum, s) => sum + (Number(s.total_amount) || 0),
    0
  );

  // Consultar movimientos de efectivo
  const { data: movements } = await supabase
    .from('cash_movements')
    .select('type, amount')
    .eq('cash_register_id', shiftId);

  let depositsTotal = 0;
  let withdrawalsTotal = 0;

  (movements || []).forEach((m) => {
    const amt = Number(m.amount) || 0;
    if (m.type === 'deposit') depositsTotal += amt;
    else if (m.type === 'withdrawal') withdrawalsTotal += amt;
  });

  const expectedAmount = initialAmount + cashSalesTotal + depositsTotal - withdrawalsTotal;
  const difference = finalCountedAmount - expectedAmount;

  const closeNote = `Cierre realizado. Esperado: ${expectedAmount} XAF, Contado: ${finalCountedAmount} XAF, Dif: ${difference} XAF. ${notes || ''}`;

  const { data: updatedShift, error: uErr } = await supabase
    .from('cash_shifts')
    .update({
      status: 'closed',
      final_amount: finalCountedAmount,
      total_sales: cashSalesTotal,
      closed_at: nowIso,
      notes: closeNote.trim(),
    })
    .eq('id', shiftId)
    .select()
    .single();

  if (uErr || !updatedShift) {
    throw new Error(`Error al cerrar turno de caja: ${uErr?.message}`);
  }

  return {
    shift: {
      ...updatedShift,
      initial_amount: Number(updatedShift.initial_amount) || 0,
      final_amount: Number(updatedShift.final_amount) || 0,
      total_sales: Number(updatedShift.total_sales) || 0,
    },
    expectedAmount,
    finalCountedAmount,
    difference,
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
