import React from 'react';

// "Live CCTV Feed" placeholder card from the Watchlist page (reference
// screen 4). No camera integration exists in this build, so the frame is
// styled chrome with the camera selector and Record Clip / Full Screen
// controls — functional UI, no fabricated footage. Full Screen uses the
// real Fullscreen API on the card.

export const CAMERAS = ['CAM 01 - Gate Entrance', 'CAM 02 - Main Lobby', 'CAM 03 - Parking', 'CAM 04 - Service Exit'];

type CctvFeedCardProps = {
  camera: string;
  onChangeCamera: (c: string) => void;
  onRequestFullscreen: (card: HTMLElement | null) => void;
  onUnavailable: (message: string) => void;
};

export default function CctvFeedCard({ camera, onChangeCamera, onRequestFullscreen, onUnavailable }: CctvFeedCardProps): React.ReactElement {
  return (
    <div className="xl:col-span-2 rounded-2xl border border-surface-200/60 dark:border-white/[0.07] bg-surface-100/60 dark:bg-white/[0.03] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-h2 text-navy-950 dark:text-white">Live CCTV Feed</h2>
        <div className="flex items-center gap-2">
          <select
            value={camera}
            onChange={(e) => onChangeCamera(e.target.value)}
            className="rounded-lg border border-surface-200/60 dark:border-white/[0.08] bg-surface-100/50 dark:bg-white/[0.04] px-2.5 py-1.5 text-xs text-navy-950 dark:text-navy-100">
            {CAMERAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button className="text-navy-400 hover:text-navy-200 transition-colors" aria-label="Camera settings">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={(el) => ((window as unknown as { __cctvCard: HTMLElement | null }).__cctvCard = el)}
        className="relative rounded-xl overflow-hidden border border-surface-200/60 dark:border-white/[0.08] bg-navy-950 aspect-video flex flex-col items-center justify-center">
        {/* Camera placeholder — the build has no camera integration; this is
            the frame, not fabricated footage. Connecting a real RTSP/HLS
            source later is a layout-free change. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.06),transparent_70%)]" />
        <svg className="w-14 h-14 text-navy-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p className="text-xs text-navy-400">{camera} — placeholder feed</p>
        <p className="text-[10px] text-navy-500 mt-1">No camera source connected</p>

        <span className="absolute left-3 top-3 rounded bg-navy-900/80 px-2 py-1 text-[10px] font-medium text-navy-200">{camera}</span>
        <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded bg-navy-900/80 px-2 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-danger-500 animate-pulse" />
          <span className="text-[10px] font-bold text-navy-200">LIVE</span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => onUnavailable('Recording clips is not available until a camera source is connected.')}
          className="rounded-lg border border-surface-200/60 dark:border-white/[0.12] text-navy-700 dark:text-navy-200 hover:bg-surface-100/70 dark:hover:bg-white/[0.05] text-sm font-semibold px-3 py-2.5 flex items-center justify-center gap-2 transition-colors">
          <svg className="w-4 h-4 text-danger-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="7" />
          </svg>
          Record Clip
        </button>
        <button
          onClick={() => onRequestFullscreen((window as unknown as { __cctvCard?: HTMLElement }).__cctvCard ?? null)}
          className="rounded-lg border border-surface-200/60 dark:border-white/[0.12] text-navy-700 dark:text-navy-200 hover:bg-surface-100/70 dark:hover:bg-white/[0.05] text-sm font-semibold px-3 py-2.5 flex items-center justify-center gap-2 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
          Full Screen
        </button>
      </div>
    </div>
  );
}
