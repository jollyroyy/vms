import React from 'react';

export const DARK_STAGE = 'relative min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-accent-900 overflow-hidden';

export default function AuroraBackdrop(): React.ReactElement {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-500/25 blur-3xl animate-aurora" />
      <div className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-accent-500/20 blur-3xl animate-aurora-alt" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-brand-700/25 blur-3xl animate-aurora" />
    </div>
  );
}
