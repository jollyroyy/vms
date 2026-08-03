import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { STATUS_STYLES } from '../../lib/statusStyles';
import { formatDateTime } from '../../lib/formatDate';
import { attachHostNames } from '../../lib/hostNames';
import { parseSearchQuery, SEARCH_KIND_LABEL, type ParsedQuery } from '../../lib/visitorSearch';

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
    : supabase.from('visitors').select('id').ilike('full_name', `%${parsed.value}%`);

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

export default function GuardSearch(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [parsed, setParsed] = useState<ParsedQuery | null>(() => parseSearchQuery(initialQuery));
  const [visits, setVisits] = useState<Visit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
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
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-xl font-bold text-navy-950 dark:text-white mb-4">Search</h1>

      <input
        type="text"
        autoFocus
        className="input w-full text-base"
        placeholder="Name, phone or reference number"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
      />

      {parsed && (
        <p className="text-xs text-navy-400 mt-2">Searching by: {SEARCH_KIND_LABEL[parsed.kind]}</p>
      )}

      <div className="card overflow-hidden mt-4">
        {!parsed ? (
          <div className="py-10 px-5 text-center">
            <p className="text-sm font-semibold text-navy-500">Type a name, phone number or reference number to search.</p>
          </div>
        ) : searching ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
          </div>
        ) : searched && visits.length === 0 ? (
          <div className="py-10 px-5 text-center">
            <p className="text-sm font-semibold text-navy-500">No matching visits found.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-white/[0.05]">
            {visits.map((v) => {
              const style = STATUS_STYLES[v.status];
              return (
                <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-navy-900 dark:text-white truncate">{v.visitor?.full_name ?? '—'}</p>
                    <p className="text-xs text-navy-400 truncate">
                      {v.visitor?.phone ?? '—'}
                      {v.visitor?.vendor_name ? ` · ${v.visitor.vendor_name}` : ''}
                      {v.department?.name ? ` · ${v.department.name}` : ''}
                      {v.host?.full_name ? ` · Host: ${v.host.full_name}` : ''}
                    </p>
                    <p className="text-[11px] text-navy-300 mt-0.5">{formatDateTime(v.created_at)}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-md ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
