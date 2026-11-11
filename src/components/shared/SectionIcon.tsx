/**
 * Inline SVG icons for the homepage "Browse by Section" hub.
 * Inline so they inherit `currentColor` and look crisp on any background
 * in both light and dark themes. Add a new section here + in Home.tsx.
 */
import React from 'react';

export type SectionKey =
  | 'shops'
  | 'bus'
  | 'schools'
  | 'mess'
  | 'pg'
  | 'banks'
  | 'gov'
  | 'hospitals'
  | 'lostfound'
  | 'news';

interface Props {
  name: SectionKey;
  className?: string;
  strokeWidth?: number;
}

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
};

export function SectionIcon({ name, className = 'w-7 h-7', strokeWidth = 1.75 }: Props) {
  const sw = strokeWidth;
  switch (name) {
    case 'shops':
      return (
        <svg {...base} className={className} strokeWidth={sw}>
          <path d="M3 9l1.5-4.5h15L21 9" />
          <path d="M4 9v10h16V9" />
          <path d="M9 19v-5h6v5" />
          <path d="M3 9c0 1.66 1.34 3 3 3s3-1.34 3-3M9 9c0 1.66 1.34 3 3 3s3-1.34 3-3M15 9c0 1.66 1.34 3 3 3s3-1.34 3-3" />
        </svg>
      );
    case 'bus':
      return (
        <svg {...base} className={className} strokeWidth={sw}>
          <rect x="4" y="4" width="16" height="13" rx="2" />
          <path d="M4 11h16" />
          <path d="M8 4v3M16 4v3" />
          <circle cx="8" cy="18.5" r="1.5" />
          <circle cx="16" cy="18.5" r="1.5" />
          <path d="M6 17v1.5M18 17v1.5" />
        </svg>
      );
    case 'schools':
      return (
        <svg {...base} className={className} strokeWidth={sw}>
          <path d="M2 9l10-5 10 5-10 5L2 9z" />
          <path d="M6 11v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5" />
          <path d="M22 9v5" />
        </svg>
      );
    case 'mess':
      return (
        <svg {...base} className={className} strokeWidth={sw}>
          <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2" />
          <path d="M15 2v19" />
          <path d="M6 2v19" />
          <path d="M9 2v4a3 3 0 0 1-6 0V2" />
        </svg>
      );
    case 'pg':
      return (
        <svg {...base} className={className} strokeWidth={sw}>
          <path d="M2 4v16" />
          <path d="M2 8h18a2 2 0 0 1 2 2v10" />
          <path d="M2 17h20" />
          <path d="M6 8v9" />
        </svg>
      );
    case 'banks':
      return (
        <svg {...base} className={className} strokeWidth={sw}>
          <path d="M3 10l9-6 9 6" />
          <path d="M4 10v8M20 10v8M8 10v8M12 10v8M16 10v8" />
          <path d="M2.5 20h19" />
        </svg>
      );
    case 'gov':
      return (
        <svg {...base} className={className} strokeWidth={sw}>
          <path d="M12 3l9 5H3l9-5z" />
          <path d="M5 8v9M19 8v9M9.5 8v9M14.5 8v9" />
          <path d="M3 17h18M3 20h18" />
          <path d="M10 3a2 2 0 014 0" />
        </svg>
      );
    case 'hospitals':
      return (
        <svg {...base} className={className} strokeWidth={sw}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M12 9v6M9 12h6" />
          <path d="M8 20v-3M16 20v-3" />
        </svg>
      );
    case 'lostfound':
      return (
        <svg {...base} className={className} strokeWidth={sw}>
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-4.5-4.5" />
          <path d="M9.5 10a1.5 1.5 0 113 0c0 1-1.5 1.5-1.5 2.5" />
          <path d="M11 14.5v.01" />
        </svg>
      );
    case 'news':
      return (
        <svg {...base} className={className} strokeWidth={sw}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 9h6M7 12h6M7 15h4" />
          <path d="M16 9h2M16 12h2M16 15h2" />
        </svg>
      );
  }
}