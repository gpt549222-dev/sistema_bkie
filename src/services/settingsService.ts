import { supabase } from './supabase';
import { BusinessSettings } from '../types';

export const DEFAULT_SETTINGS: BusinessSettings = {
  business_name: 'BIKIE Sistemas Informáticos',
  rif_tax_id: '0214081-21',
  phone: '333098318 - 222544924 - 222213126',
  whatsapp: '+240 222544924',
  address: 'BARRIO EL PARAISO (cerca la guardería "Los Chupetes") - Malabo / Bata, GE',
  currency: 'XAF',
  currency_symbol: 'FCFA',
  tax_rate: 15,
  pago_movil_info: 'Orange Money / MTN MoMo • Tel: 222544924 / 333098318',
  binance_info: 'bikie_sistemas@pay.binance (Pay ID: 394819201)',
  bank_transfer_info: 'BANGE • Cta: 37101193101-51 • Sistemas Informáticos Bikie',
  invoice_prefix: 'BIKIE',
  sound_notifications_enabled: true,
};

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'business_info')
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_SETTINGS;
  }
  return { ...DEFAULT_SETTINGS, ...data.value };
}

export async function updateBusinessSettings(settings: Partial<BusinessSettings>): Promise<void> {
  const current = await getBusinessSettings();
  const updated = { ...current, ...settings };

  const { error } = await supabase
    .from('settings')
    .upsert({
      key: 'business_info',
      value: updated,
      description: 'Configuración oficial de BIKIE Papelería',
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Error al guardar configuración en Supabase: ${error.message}`);
  }
}

