import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { VisitFeedback } from '../types/index';
import { istDayStart } from './visitExpiry';

// Guest satisfaction ratings (migration 086).
//
// A separate hook rather than a join onto `useAdminVisits`, because the two
// answer different questions over different windows: the dashboard tile
// averages TODAY'S ratings, while a rating is written at check-OUT and may land
// hours after the visit that earned it was created. Joining would tie the
// rating's window to the visit's and quietly drop the evening's feedback from
// the morning's visits.
//
// RLS restricts reads to admin and HOD (a satisfaction score is a judgement of
// the people who hosted the visit, and a gate screen is where the visitor who
// wrote it may be standing), so an error here is expected for any other role
// and resolves to an empty list rather than an error banner.

export function useVisitFeedback(sinceDayStart = true): {
  feedback: VisitFeedback[];
  loading: boolean;
} {
  const [feedback, setFeedback] = useState<VisitFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let q = supabase.from('visit_feedback').select('*').order('created_at', { ascending: false });
      if (sinceDayStart) q = q.gte('created_at', istDayStart().toISOString());

      const { data } = await q;
      if (cancelled) return;
      setFeedback((data as unknown as VisitFeedback[]) ?? []);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [sinceDayStart]);

  return { feedback, loading };
}
