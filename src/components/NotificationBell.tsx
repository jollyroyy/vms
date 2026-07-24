import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { UserRole, Notification } from '../types/index';

interface Props {
  userId: string;
  role: UserRole | null;
}

const UNREAD_POLL_MS = 30000;

export default function NotificationBell({ userId, role }: Props): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isEligible = role && ['hod', 'guard', 'admin'].includes(role);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) return;
      const rows = (data ?? []) as unknown as Notification[];
      setNotifications(rows);
      setUnreadCount(rows.filter((n) => !n.is_read).length);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => void fetchNotifications(), UNREAD_POLL_MS);
    const channel = supabase.channel('notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` }, () => {
        void fetchNotifications();
      })
      .subscribe();
    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [fetchNotifications, userId]);

  const markRead = async (id: string) => {
    if (loading) return;
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    if (loading) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  if (!isEligible) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-surface-100 transition-all duration-200"
        title="Notifications"
      >
        <svg className="w-5 h-5 text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-5 min-w-[20px] flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 bg-white rounded-2xl shadow-modal border border-surface-200/80 overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-100">
              <h3 className="text-sm font-bold text-navy-900">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={() => void markAllRead()} className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 rounded-full border-2 border-navy-200 border-t-brand-600 animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center px-4">
                  <svg className="w-8 h-8 text-surface-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                  <p className="text-sm text-navy-400 font-medium">No notifications</p>
                  <p className="text-xs text-navy-300 mt-0.5">You are all caught up.</p>
                </div>
              ) : (
                <ul className="divide-y divide-surface-100">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`px-5 py-3.5 transition-colors ${!n.is_read ? 'bg-brand-50/40' : 'hover:bg-surface-50'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`shrink-0 mt-0.5 h-2 w-2 rounded-full ${!n.is_read ? 'bg-brand-500' : 'bg-transparent'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!n.is_read ? 'font-semibold text-navy-900' : 'font-medium text-navy-700'}`}>
                            {n.title}
                          </p>
                          <p className="text-xs text-navy-400 mt-0.5 line-clamp-2">{n.body}</p>
                          <p className="text-[10px] text-navy-300 mt-1">
                            {new Date(n.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!n.is_read && (
                          <button
                            onClick={() => void markRead(n.id)}
                            className="shrink-0 text-[10px] font-semibold text-brand-600 hover:text-brand-700 mt-1"
                          >
                            Read
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
