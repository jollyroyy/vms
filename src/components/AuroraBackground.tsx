import React from 'react';

/**
 * Fixed ambient aurora background — drifting violet/magenta gradient blobs
 * over a fading grid. Rendered behind the app shell and login page.
 */
export default function AuroraBackground(): React.ReactElement {
  return (
    <div className="aurora-stage" aria-hidden="true">
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />
      <div className="aurora-grid" />
    </div>
  );
}
