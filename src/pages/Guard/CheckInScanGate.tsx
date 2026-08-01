// Owns the optional QR-scan entry point so CheckInPanel doesn't grow past its
// line cap. Gated by the 'qr' feature flag: when the flag is off this renders
// nothing at all, so the existing manual search flow is byte-for-byte
// untouched in production until the flag is flipped on. GuardQRScan is a plain
// top-level import (cheap — it only starts the camera once mounted), but it is
// never mounted while scanning is false, so no camera opens with the flag off.
import React, { useState } from 'react';
import type { Visit } from '../../types/index';
import { isFeatureEnabled } from '../../lib/featureFlags';
import GuardQRScan from './GuardQRScan';

type Props = {
  onResolved: (visit: Visit) => void;
};

export default function CheckInScanGate({ onResolved }: Props): React.ReactElement | null {
  const [scanning, setScanning] = useState(false);

  if (!isFeatureEnabled('qr')) return null;

  if (scanning) {
    return (
      <GuardQRScan
        onResolved={(visit) => { setScanning(false); onResolved(visit); }}
        onCancel={() => setScanning(false)}
      />
    );
  }

  return (
    <button
      onClick={() => setScanning(true)}
      className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h4.5v4.5h-4.5v-4.5zM15.75 4.5h4.5v4.5h-4.5v-4.5zM3.75 15.75h4.5v4.5h-4.5v-4.5zM15.75 15.75h1.5v1.5h-1.5v-1.5zM19.5 15.75h.75v.75h-.75v-.75zM15.75 19.5h.75v.75h-.75v-.75zM18.75 18.75h1.5v1.5h-1.5v-1.5z" />
      </svg>
      Scan QR
    </button>
  );
}
