// Is the number the guard is typing already out in the building?
//
// The check exists in the write path too (lib/cardAssignment.findCardHolder,
// backed by migration 102's unique indexes), and that is the one that is
// authoritative. This hook exists because the write happens AFTER the guard has
// handed the card over: being told "C-104 is still with Priya Nair" while the
// card is in your hand costs nothing, and being told it after the visitor has
// pocketed it costs the exchange.
//
// Debounced, and guarded against the response race with a request id — the same
// shape lib/useVisitHistorySearch.ts uses, and for the same reason: a guard
// types four characters in half a second and the answers come back in whatever
// order the network chooses.
import { useEffect, useRef, useState } from 'react';
import { findCardHolder, type CardHolder } from './cardAssignment';
import { isValidCardNumber } from './cardNumber';

export type CardAvailability = {
  /** The open, unreturned issue of this number, or null when it is free. */
  holder: CardHolder | null;
  /** True while a lookup is in flight — never a reason to block the button on
   *  its own (the write re-checks), only to keep the field from flashing
   *  "available" before anything has been asked. */
  checking: boolean;
};

const DEBOUNCE_MS = 350;

export function useCardAvailability(cardNumber: string, excludeVisitId?: string): CardAvailability {
  const [holder, setHolder] = useState<CardHolder | null>(null);
  const [checking, setChecking] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    if (!isValidCardNumber(cardNumber)) {
      setHolder(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    const t = setTimeout(() => {
      void findCardHolder(cardNumber, { excludeVisitId }).then((found) => {
        if (id !== requestId.current) return;
        setHolder(found);
        setChecking(false);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [cardNumber, excludeVisitId]);

  return { holder, checking };
}
