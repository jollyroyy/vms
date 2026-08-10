import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { UserRole, Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { parseSearchQuery, SEARCH_KIND_LABEL, type ParsedQuery } from '../../lib/visitorSearch';
import { escapeLikePattern } from '../../lib/inputRules';
import VisitorDetails from '../../components/VisitorDetails';
import SearchResultCard from './SearchResultCard';

const VISIT_SELECT = `*, visitor:visitors(*), department:departments(id, name, code, created_at)`;

// Runs the query for one parsed kind. Phone/name filter on the visitor table
// first, then fetch visits by visitor_id — a two-step lookup, chosen over the
// `visitor:visitors!inner(*)` embedded-filter syntax because it is simpler to
// reason about and does not depend on PostgREST's embedded-resource filtering
// behaving consistently across joined tables.
async function runSearch(parsed: ParsedQuery): Promise<Visit[]> {
  if (parsed.kind === 'ref') {
    const { data } = await supabase
      .from('visits')
      .select(VISIT_SELECT)
      .eq('ref_number', parsed.value)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data as unknown as Visit[]) ?? [];
  }

  const visitorFilter = parsed.kind === 'phone'
    ? supabase.from('visitors').select('id').eq('phone', parsed.value)
    // `%` and `_` are LIKE wildcards. Unescaped, a search for "%" is a valid
    // pattern matching EVERY visitor — a name lookup that quietly becomes a
    // full directory dump. Not an injection (PostgREST parameterises the
    // value), but the result is an enumeration hole all the same.
    : supabase.from('visitors').select('id').ilike('full_name', `%${escapeLikePattern(parsed.value)}%`);

  const { data: visitorRows } = await visitorFilter;
  const visitorIds = ((visitorRows as { id: string }[] | null) ?? []).map((v) => v.id);
  if (visitorIds.length === 0) return [];

  const { data } = await supabase
    .from('visits')
    .select(VISIT_SELECT)
    .in('visitor_id', visitorIds)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data as unknown as Visit[]) ?? [];
}

type Props = {
  // Threaded through from AppShell so <VisitorDetails> can gate the entry
  // pass correctly — it fails closed on an unknown viewer, so this must be
  // the real role, never omitted. Optional only because /guard/search still
  // renders this component without a role prop in some older call sites.
  role?: UserRole | null;
};

export default function GuardSearch({ role }: Props): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [parsed, setParsed] = useState<ParsedQuery | null>(() => parseSearchQuery(initialQuery));
  const [visits, setVisits] = useState<Visit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const seq = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const next = parseSearchQuery(query);
    setParsed(next);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!next) {
      setVisits([]);
      setSearching(false);
      setSearched(false);
      return;
    }

    setSearching(true);
    const mySeq = ++seq.current;
    debounceTimer.current = setTimeout(() => {
      void (async () => {
        let rows = await runSearch(next);
        rows = await attachHostNames(rows);
        if (mySeq !== seq.current) return; // stale response — a newer query superseded this one
        setVisits(rows);
        setSearching(false);
        setSearched(true);
      })();
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function handleChange(value: string): void {
    setQuery(value);
    setSearchParams(value ? { q: value } : {}, { replace: true });
  }

  return (
    <div className="max-w-3xl mx-auto">
      {detailVisit && (
        <VisitorDetails
          visit={detailVisit}
          viewerRole={role}
          onClose={() => setDetailVisit(null)}
        />
      )}

      <h1 className="font-display text-xl font-bold text-navy-950 dark:text-white mb-4">Search</h1>

      <input
        type="text"
        autoFocus
        className="input w-full text-base"
        placeholder="Visitor name, phone or reference number"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
      />

      {parsed && (
        <p className="text-xs text-navy-400 mt-2">Searching by: {SEARCH_KIND_LABEL[parsed.kind]}</p>
      )}

      <div className="mt-4">
        {!parsed ? (
          <div className="card py-10 px-5 text-center">
            <p className="text-sm font-semibold text-navy-500">Type a visitor name, phone number or reference number to search.</p>
          </div>
        ) : searching ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-32 w-full rounded-2xl" />)}
          </div>
        ) : searched && visits.length === 0 ? (
          <div className="card py-10 px-5 text-center">
            <p className="text-sm font-semibold text-navy-500">No matching visits found.</p>
          </div>
        ) : (
          // A full-width vertical stack, not a grid — see WhosInside.tsx for
          // the same client feedback (2026-08-10).
          <div data-card-list className="flex flex-col gap-4">
            {visits.map((v) => (
              <SearchResultCard key={v.id} visit={v} onClick={() => setDetailVisit(v)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
