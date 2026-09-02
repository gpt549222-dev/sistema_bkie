import { supabase } from './supabase';
import { AppNotification } from '../types';

export async function getNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Error al obtener notificaciones: ${error.message}`);
  }

  return (data || []).map((n: any) => ({
    ...n,
    is_read: Boolean(n.is_read),
  }));
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);

  if (error) {
    throw new Error(`Error al marcar notificación: ${error.message}`);
  }
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false);

  if (error) {
    throw new Error(`Error al marcar todas las notificaciones: ${error.message}`);
  }
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Error al eliminar notificación: ${error.message}`);
  }
}

export async function deleteAllNotifications(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // deletes all rows

  if (error) {
    throw new Error(`Error al limpiar notificaciones: ${error.message}`);
  }
}

export async function clearReadNotifications(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('is_read', true);

  if (error) {
    throw new Error(`Error al limpiar notificaciones leídas: ${error.message}`);
  }
}

