import React from 'react';

type Props = {
  title: string;
  message: string;
  onClose: () => void;
};

export default function SuccessPopup({ title, message, onClose }: Props): React.ReactElement {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-sm p-0 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-success-500/10 to-success-600/5 p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-success-400 to-success-600 flex items-center justify-center shadow-glow-sm ring-4 ring-success-100 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-navy-900 font-display">{title}</h3>
          <p className="text-sm text-navy-500 mt-1.5 leading-relaxed">{message}</p>
        </div>
        <div className="px-8 pb-6 pt-4 flex justify-center">
          <button onClick={onClose}
            className="w-full max-w-[160px] rounded-xl bg-gradient-to-r from-success-500 to-success-600 text-white py-2.5 text-sm font-semibold shadow-glow-sm hover:shadow-glow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
