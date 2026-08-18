import React from 'react';
import { createPortal } from 'react-dom';
import ModalCloseButton from './ModalCloseButton';
import { useEscapeKey } from '../lib/useEscapeKey';

type Props = {
  title: string;
  // Optional since 2026-08-11: PreApproveForm's success popup stopped
  // wording the ref here — the freshly issued pass below already shows it.
  message?: string;
  onClose: () => void;
  children?: React.ReactNode;
};

export default function SuccessPopup({ title, message, onClose, children }: Props): React.ReactElement {
  useEscapeKey(onClose);

  // PORTALED to document.body: this popup is rendered inside
  // PreApproveForm's `card-premium` form (backdrop-filter), and a
  // backdrop-filter ancestor becomes the containing block for `position:
  // fixed` descendants — inline, the `modal-overlay` filled the form card
  // instead of the viewport: the dark blur dimmed only the card, the rest of
  // the page stayed lit and clickable, and outside clicks could not dismiss
  // it. The pass printed inside still portals with it, so the copy a
  // visitor shows never renders inside the form's box.
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      {/* Same discipline as VisitorDetails: `!overflow-hidden` + an inner
          scroller instead of letting .modal-content scroll itself. This popup
          is the one that carries the freshly issued entry pass, and on a short
          screen the pass (QR + identity + downloads) overflowed the 90vh cap —
          so the modal scrolled, taking the absolute top-right close button
          with it: out of reach the moment the content moved, and sitting under
          the scrollbar gutter at rest. Outside the scroller it is fixed and
          always whole. */}
      <div
        className="modal-content max-w-sm p-0 relative !overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClose={onClose} />
        {/* min-h-0 is load-bearing: without it a flex child refuses to shrink
            below its content and the scrollbar never appears. */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* THE HEADER IS CENTRED; THE CONTENT BELOW IT IS NOT (2026-08-18,
              client instruction: align the success popup properly and make it
              more premium). The tick, the title and the message are an
              announcement and read best on the centre line. The entry pass
              underneath is a DOCUMENT — labelled facts in a column — and it
              used to be rendered inside this same block, inheriting
              `text-center` and the success tint, so every label sat over a
              value of a different width and the whole card floated on green.
              Two sections now: the announcement on the tinted ground, the
              document on the modal's own surface, divided by a hairline. */}
          <div className="bg-gradient-to-br from-success-500/10 to-success-600/5 px-7 pt-8 pb-6 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-success-400 to-success-600 flex items-center justify-center shadow-glow-sm ring-4 ring-success-100 mb-3.5">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-navy-900 font-display leading-snug px-6">{title}</h3>
            {message && <p className="text-sm text-navy-700 mt-1.5 leading-relaxed">{message}</p>}
          </div>

          {children && (
            <div className="border-t border-surface-200/70 dark:border-white/[0.08] px-5 pt-5">
              {children}
            </div>
          )}

          <div className="px-5 pb-6 pt-5 flex justify-center">
            <button onClick={onClose}
              className="w-full max-w-[200px] rounded-xl bg-gradient-to-r from-success-500 to-success-600 text-white py-2.5 text-sm font-semibold shadow-glow-sm hover:shadow-glow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
