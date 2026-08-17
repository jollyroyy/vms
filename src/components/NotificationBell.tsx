import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { UserRole, Notification } from '../types/index';
import ModalCloseButton from './ModalCloseButton';
import { useEscapeKey } from '../lib/useEscapeKey';

interface Props {
  userId: string;
  role: UserRole | null;
}

const UNREAD_POLL_MS = 30000;

export default function NotificationBell({ userId, role }: Props): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.length;

  const isEligible = role && ['hod', 'guard', 'admin'].includes(role);

  const fetchNotifications = useCallback(async () => {
    try {
      const todayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .eq('is_read', false)
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) return;
      setNotifications((data ?? []) as unknown as Notification[]);
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

  // Both writes drop the row optimistically and then RE-READ if the write came
  // back with an error. Without that, a refused update (RLS, a dropped
  // connection) leaves the badge reading one fewer than the database holds until
  // the 30s poll quietly puts it back — the bell would look like it worked and
  // then undo itself.
  const markRead = async (id: string) => {
    if (loading) return;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) void fetchNotifications();
  };

  const markAllRead = async () => {
    if (loading) return;
    const unreadIds = notifications.map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications([]);
    const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    if (error) void fetchNotifications();
  };

  useEscapeKey(() => setOpen(false), open);

  // CLICK-AWAY IS A LISTENER, NOT AN OVERLAY (client report, 2026-08-16: "Read"
  // and "Mark all read" did nothing). The dropdown used to close via a
  // `fixed inset-0 z-40` scrim portaled to document.body. That scrim wins the
  // paint order against the whole app: the panel's z-50 is resolved INSIDE
  // AppShell's `app-shell-content` stacking context (`relative z-10`), so at the
  // root it is a z-10 subtree sitting under a z-40 sibling. Every click aimed at
  // a button in the panel landed on the scrim instead — the dropdown closed and
  // nothing was ever marked read. A document listener has no paint order to lose:
  // the ref wraps the bell and the panel, so anything outside it closes.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  if (!isEligible) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-surface-100 transition-all duration-200"
        title="Notifications"
      >
        {/* `text-navy-800`, matching TopbarClock immediately to its left —
            they are one right-hand cluster and must read as one. It was
            `navy-500`, which is the same step the clock was corrected from
            (2026-08-15): rgb(128,120,106) is a weak stroke against the glass
            topbar at either end of the theme. */}
        <svg className="w-5 h-5 text-navy-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-5 min-w-[20px] flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* THE PANEL IS WHITE IN LIGHT MODE, SO NOTHING ON IT MAY BE WHITE
          (client report, 2026-08-17: the notification text was unreadable in
          light mode). This panel was written dark-first — `bg-white` was the
          afterthought and the foreground was never revisited — so the heading
          and every notification title were `text-white` ON WHITE, i.e.
          rendered and invisible, and the borders were `white/10` on that same
          white. Same class of defect as the topbar clock's `dark:text-navy-300`:
          a colour that only ever resolved for the theme its author happened to
          be looking at.

          Every foreground here is now a SINGLE navy step with no `dark:`
          override, because the navy scale is inverted between themes — one
          number already resolves to the correct end at both. `navy-950` for a
          title, `navy-700` for body prose, `navy-600` for a timestamp. */}
      {open && (
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 rounded-2xl shadow-modal border border-surface-200 dark:border-white/10 overflow-hidden animate-scale-in dark:bg-[rgb(20_18_14)] dark:bg-opacity-100 bg-white">
            {/* The × is an INLINE flex child here, not the absolute default.
                This row is compact and already has content on its right, so an
                out-of-flow button had nothing reserving space for it: the old
                `pr-14` left the close button's left edge 4px from "Mark all
                read", which is the overlap that was reported. As a flex child
                it cannot collide with its siblings at any width, so no padding
                value has to be kept in step with the button's size. */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-surface-200 dark:border-white/10">
              <h3 className="flex-1 min-w-0 text-sm font-bold text-navy-950 truncate">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => void markAllRead()}
                  className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                  Mark all read
                </button>
              )}
              {/* The DEFAULT (light) variant, not `dark`. `dark` hardcodes a
                  white glyph on a white plate, which is right over a dark
                  gradient banner and wrong here — this panel is white in light
                  mode. The default already carries its own `dark:` half, so it
                  is the only variant that resolves at both ends. */}
              <ModalCloseButton
                inline
                className="-mr-2"
                onClose={() => setOpen(false)}
              />
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
                  <p className="text-sm text-navy-700 font-medium">No notifications</p>
                  <p className="text-xs text-navy-600 mt-0.5">You are all caught up.</p>
                </div>
              ) : (
                <ul className="divide-y divide-surface-200 dark:divide-white/[0.08]">
                  {notifications.map((n) => (
                    <li key={n.id} className="px-5 py-3.5 transition-colors bg-brand-500/10">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5 h-2 w-2 rounded-full bg-brand-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy-950">{n.title}</p>
                          <p className="text-xs text-navy-700 mt-0.5 line-clamp-2">{n.body}</p>
                          <p className="text-[10px] text-navy-600 mt-1">
                            {new Date(n.created_at).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => void markRead(n.id)}
                          className="shrink-0 text-[10px] font-semibold text-brand-600 hover:text-brand-700 mt-1"
                        >
                          Read
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
      )}
    </div>
  );
}
