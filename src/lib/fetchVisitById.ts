// ONE VISIT, WHOLE, BY ID — and one definition of what "whole" means.
//
// A search hit is a `MatchItem`: a projection assembled for a list, deliberately
// narrow. Two things on the guard surface need the real row instead — the exit
// (`CardReturnConfirm` needs the card number to demand back and the status to
// refuse somebody who is not inside) and, since 2026-08-18, Find & Scan's
// detail frame, which is the Entry & Exit frame and reads the photo, the ID
// type, the vehicle, the QR token and every timeline stamp.
//
// Both fetch the SAME row with the SAME embeds, so the select lives here once.
// `checkOutFlow.fetchVisitForExit` delegates to it and keeps its own name,
// because at the call site "the visit I am about to check out" is the honest
// description of what is being read.
//
// It is a fetch AT THE PRESS, not a widening of the list: another device may
// have checked this visitor out while the results sat on screen, so the row the
// guard acts on should be read a moment before they act, not a minute before
// they looked.
import { supabase } from '../supabaseClient';
import type { Visit } from '../types/index';

const VISIT_SELECT = '*, visitor:visitors(*), department:departments(id, name, code, created_at)';

export async function fetchVisitById(visitId: string): Promise<Visit | null> {
  const { data, error } = await supabase
    .from('visits')
    .select(VISIT_SELECT)
    .eq('id', visitId)
    .maybeSingle();
  if (error) {
    console.error('[fetchVisitById] could not load the visit', error);
    return null;
  }
  return (data as unknown as Visit | null) ?? null;
}
