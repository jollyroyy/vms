import React from 'react';
import ScanPassSearchBar from './ScanPassSearchBar';

// The top of Find & Scan: the search box, and one line under it offering the
// camera. Extracted from `ScanPass.tsx` on 2026-08-18 when the page gained the
// visitor-detail frame and went over the 300-line cap; the reasoning it carries
// is unchanged and is the reason it must stay this small.
//
// NO PAGE TITLE AND NO SUBTITLE (client instruction, 2026-08-17). The sidebar
// item the guard just pressed already says "Find & Scan", and the line under it
// only described the two controls directly beneath it.
//
// EITHER THE SEARCH, OR THE LINK FOR SCAN — and nothing else on this row
// (client instruction, 2026-08-18). What used to sit here was the whole scanner
// card: a heading, a paragraph, a dark 3:4 placeholder the size of the camera
// frame and three buttons, all of it above the results, on a page whose
// commonest use is typing a mobile number. A guard who wants the camera says so
// in one press; a guard who does not never sees it.

type Props = {
  onQueryChange: (q: string) => void;
  /** Once the scanner is open the link has nothing left to offer. */
  scanOpen: boolean;
  onOpenScanner: () => void;
};

export default function ScanPassEntryBar({ onQueryChange, scanOpen, onOpenScanner }: Props): React.ReactElement {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <ScanPassSearchBar onQueryChange={onQueryChange} />
      </div>
      {!scanOpen && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onOpenScanner}
            className="inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:text-brand-800 hover:underline underline-offset-4 rounded-lg px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h4.5v4.5h-4.5v-4.5zM15.75 4.5h4.5v4.5h-4.5v-4.5zM3.75 15.75h4.5v4.5h-4.5v-4.5zM15.75 15.75h1.5v1.5h-1.5v-1.5zM19.5 15.75h.75v.75h-.75v-.75zM15.75 19.5h.75v.75h-.75v-.75zM18.75 18.75h1.5v1.5h-1.5v-1.5z" />
            </svg>
            Scan QR code
          </button>
        </div>
      )}
    </div>
  );
}
