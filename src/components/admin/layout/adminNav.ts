import {
  LayoutDashboard, Store, Tag, Inbox, Wrench, Megaphone,
  Bus, Hospital, GraduationCap, Landmark, Building2, SearchX, Newspaper,
  BarChart2, Database, Languages, ShieldCheck, Layers, Plug,
  UtensilsCrossed, BedDouble,
} from 'lucide-react';

export type HubKey = 'overview' | 'directory' | 'sections' | 'marketing' | 'insights' | 'system';

export interface LeafNav {
  key: string;
  label: string;
  path: string;          // absolute path under /admin
  icon: any;
  badgeKey?: 'inbox';
  status?: 'live' | 'soon';
}

export interface HubNav {
  key: HubKey;
  label: string;
  icon: any;
  path: string;          // landing for the hub
  leaves: LeafNav[];
}

/** Single source of truth for the admin navigation tree.
 *  Add a new section by registering a leaf under `sections`. */
export const ADMIN_NAV: HubNav[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    path: '/admin/overview',
    leaves: [],
  },
  {
    key: 'directory',
    label: 'Directory',
    icon: Store,
    path: '/admin/directory/shops',
    leaves: [
      { key: 'shops',      label: 'Shops',           path: '/admin/directory/shops',      icon: Store },
      { key: 'mess',       label: 'Mess & Hotels',   path: '/admin/directory/mess',       icon: UtensilsCrossed },
      { key: 'pg',         label: 'PG & Hostels',    path: '/admin/directory/pg',         icon: BedDouble },
      { key: 'categories', label: 'Categories',      path: '/admin/directory/categories', icon: Tag },
      { key: 'inbox',      label: 'Claims & Requests', path: '/admin/directory/inbox',    icon: Inbox, badgeKey: 'inbox' },
    ],
  },
  {
    key: 'sections',
    label: 'Sections',
    icon: Layers,
    path: '/admin/sections',
    leaves: [
      { key: 'bus',       label: 'Bus Timetable', path: '/admin/sections/bus',       icon: Bus,           status: 'live' },
      { key: 'hospitals', label: 'Hospitals',     path: '/admin/sections/hospitals', icon: Hospital,      status: 'soon' },
      { key: 'schools',   label: 'Education & Institutes', path: '/admin/sections/schools', icon: GraduationCap, status: 'live' },
      { key: 'banks',     label: 'Banks',         path: '/admin/sections/banks',     icon: Landmark,      status: 'soon' },
      { key: 'gov',       label: 'Essential Services & Authorities', path: '/admin/sections/gov', icon: Building2, status: 'live' },
      { key: 'lostfound', label: 'Lost & Found',  path: '/admin/sections/lostfound', icon: SearchX,       status: 'soon' },
      { key: 'news',      label: 'Local News',    path: '/admin/sections/news',      icon: Newspaper,     status: 'soon' },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    path: '/admin/marketing/ads',
    leaves: [
      { key: 'ads', label: 'Advertisements', path: '/admin/marketing/ads', icon: Megaphone },
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    icon: BarChart2,
    path: '/admin/insights/analytics',
    leaves: [
      { key: 'analytics', label: 'Analytics', path: '/admin/insights/analytics', icon: BarChart2 },
    ],
  },
  {
    key: 'system',
    label: 'System',
    icon: ShieldCheck,
    path: '/admin/system/data',
    leaves: [
      { key: 'data',     label: 'Data Backup',          path: '/admin/system/data',     icon: Database },
      { key: 'quality',  label: 'Storage & Health',     path: '/admin/system/quality',  icon: Wrench },
      { key: 'marathi',  label: 'Marathi Translations', path: '/admin/system/marathi',  icon: Languages },
      { key: 'mcp',      label: 'AI & Tool Integrations', path: '/admin/system/mcp',    icon: Plug },
    ],
  },
];

export function findActive(pathname: string): { hub: HubNav; leaf?: LeafNav } | null {
  for (const hub of ADMIN_NAV) {
    const leaf = hub.leaves.find((l) => pathname === l.path || pathname.startsWith(l.path + '/'));
    if (leaf) return { hub, leaf };
    if (pathname === hub.path || pathname.startsWith(hub.path + '/')) return { hub };
  }
  return null;
}
