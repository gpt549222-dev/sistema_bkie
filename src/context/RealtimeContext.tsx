import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { playNewOrderChime } from '../utils/audio';
import { useAuth } from './AuthContext';

export type RealtimeStatus = 'connected' | 'reconnecting' | 'disconnected';

interface RealtimeContextType {
  status: RealtimeStatus;
  lastEventTime: Date | null;
  unreadCount: number;
  incrementUnreadCount: () => void;
  resetUnreadCount: () => void;
  refreshTrigger: number;
  triggerGlobalRefresh: () => void;
  fetchUnreadNotificationsCount: () => Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const { user } = useAuth();

  const triggerGlobalRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const incrementUnreadCount = useCallback(() => {
    setUnreadCount((prev) => prev + 1);
  }, []);

  const resetUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Fetch real count of unread notifications from Supabase
  const fetchUnreadNotificationsCount = useCallback(async () => {
    try {
      let query = supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);

      if (user?.id) {
        query = query.or(`user_id.eq.${user.id},user_id.is.null`);
      }

      const { count, error } = await query;
      if (!error && typeof count === 'number') {
        setUnreadCount(count);
      }
    } catch {
      // ignore
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUnreadNotificationsCount();
  }, [fetchUnreadNotificationsCount, refreshTrigger]);

  useEffect(() => {
    setStatus('reconnecting');

    const channel = supabase
      .channel('bikie-realtime-global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          setLastEventTime(new Date());
          if (payload.eventType === 'INSERT') {
            playNewOrderChime();
          }
          triggerGlobalRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          setLastEventTime(new Date());
          triggerGlobalRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'offers' },
        () => {
          setLastEventTime(new Date());
          triggerGlobalRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        () => {
          setLastEventTime(new Date());
          triggerGlobalRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => {
          setLastEventTime(new Date());
          triggerGlobalRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => {
          setLastEventTime(new Date());
          // Notification unread count will be incremented accurately here
          setUnreadCount((prev) => prev + 1);
          triggerGlobalRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        () => {
          setLastEventTime(new Date());
          fetchUnreadNotificationsCount();
          triggerGlobalRefresh();
        }
      )
      .subscribe((subscribeStatus) => {
        if (subscribeStatus === 'SUBSCRIBED') {
          setStatus('connected');
        } else if (subscribeStatus === 'TIMED_OUT' || subscribeStatus === 'CHANNEL_ERROR' || subscribeStatus === 'CLOSED') {
          setStatus('disconnected');
        } else {
          setStatus('reconnecting');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [triggerGlobalRefresh, fetchUnreadNotificationsCount]);

  return (
    <RealtimeContext.Provider
      value={{
        status,
        lastEventTime,
        unreadCount,
        incrementUnreadCount,
        resetUnreadCount,
        refreshTrigger,
        triggerGlobalRefresh,
        fetchUnreadNotificationsCount,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime debe ser utilizado dentro de un RealtimeProvider');
  }
  return context;
}
