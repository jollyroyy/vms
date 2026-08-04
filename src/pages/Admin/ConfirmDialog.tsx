// Confirmation dialog. When `danger` is true (default) it shows a red warning icon
// and a danger-styled confirm button. When false it shows a blue info icon and a
// primary-styled confirm button. Exposed as role="dialog" so callers (and tests)
// can scope queries to the modal rather than the page behind it.
import React from 'react';

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  busyLabel: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  title, message, confirmLabel, busyLabel, busy = false, danger = true, onConfirm, onCancel,
}: Props): React.ReactElement {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal-content p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {danger ? (
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-danger-500/15 to-danger-600/5 text-danger-600 border border-danger-500/20 flex items-center justify-center mb-4 shadow-soft">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
        ) : (
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-500/15 to-accent-500/10 text-brand-600 border border-brand-500/20 flex items-center justify-center mb-4 shadow-soft">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
        )}
        <h3 className="text-lg font-semibold text-navy-900 dark:text-white font-display mb-2">{title}</h3>
        <p className="text-sm text-navy-500 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={danger ? 'btn-danger' : 'btn-primary'}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
