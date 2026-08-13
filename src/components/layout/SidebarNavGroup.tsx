import React from 'react';
import { Link } from 'react-router-dom';
import type { NavLink as NavLinkType } from './navLinks';
import type { VisitorCounts } from '../../lib/useVisitorCounts';
import { SEGMENT_META } from '../../lib/visitorSegments';

type Props = {
  link: NavLinkType;
  pathname: string;
  isCollapsed: boolean;
  open: boolean;
  onToggle: () => void;
  counts: VisitorCounts;
};

// A nav item that expands into its segments in place.
//
// The parent is a BUTTON, not a link: clicking "Visitors" opens the list of
// where you can go, it does not navigate somewhere that then hides its own
// contents. Reaching a segment always takes exactly one more deliberate click,
// which is what makes the sub-nav a map rather than a surprise.
//
// Collapsed rail: the group has no room to expand, so the parent degrades to a
// plain link to its landing route. A guard on a narrow terminal still gets to
// the page; they just pick the segment on the page instead of in the rail.
export default function SidebarNavGroup({
  link, pathname, isCollapsed, open, onToggle, counts,
}: Props): React.ReactElement {
  const children = link.children ?? [];
  const groupActive = pathname === link.to || pathname.startsWith(`${link.to}/`);

  if (isCollapsed) {
    return (
      <Link to={link.to} title={link.label}
        className={`sidebar-link px-3 py-2.5 justify-center !px-0 ${groupActive ? 'sidebar-link-active' : ''}`}>
        <span className="shrink-0">{link.icon}</span>
      </Link>
    );
  }

  return (
    <div>
      <button type="button" onClick={onToggle}
        aria-expanded={open}
        className={`sidebar-link w-full px-3 py-2.5 ${groupActive ? 'sidebar-link-active' : ''}`}>
        <span className="shrink-0">{link.icon}</span>
        <span className="truncate flex-1 text-left">{link.label}</span>
        <svg className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <ul className="sidebar-sub mt-1 space-y-0.5">
          {children.map((child) => {
            // Exact match only. `/visitors` is the parent of every segment
            // path, so a startsWith test would light up "All Visitors" on
            // every single segment and tell the guard nothing about where
            // they are.
            const active = pathname === child.to;
            const count = child.segment ? counts[child.segment] : undefined;
            const showCount = Boolean(child.segment && SEGMENT_META[child.segment].showCount);
            return (
              <li key={child.to}>
                <Link to={child.to}
                  aria-current={active ? 'page' : undefined}
                  className={`sidebar-sublink ${active ? 'sidebar-sublink-active' : ''}`}>
                  <span className="truncate flex-1">{child.label}</span>
                  {showCount && count !== undefined && count > 0 && (
                    <span className="sidebar-subcount tabular-nums">{count}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
