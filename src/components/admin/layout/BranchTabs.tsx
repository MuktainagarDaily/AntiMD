import { NavLink } from 'react-router-dom';
import { LeafNav } from './adminNav';

interface Props {
  leaves: LeafNav[];
  badges?: Partial<Record<string, number>>;
}

/** Horizontal scrolling sub-tab strip for sibling leaves under one hub. */
export function BranchTabs({ leaves, badges = {} }: Props) {
  if (leaves.length <= 1) return null;
  return (
    <div className="sticky top-[56px] z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b mb-4 flex gap-2 overflow-x-auto scrollbar-none">
      {leaves.map((leaf) => {
        const Icon = leaf.icon;
        const badge = badges[leaf.key] ?? 0;
        return (
          <NavLink
            key={leaf.key}
            to={leaf.path}
            end
            className={({ isActive }) =>
              `relative shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card text-muted-foreground hover:text-foreground border border-border'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            <span>{leaf.label}</span>
            {leaf.status === 'soon' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                Soon
              </span>
            )}
            {badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 bg-secondary text-secondary-foreground">
                {badge}
              </span>
            )}
          </NavLink>
        );
      })}
    </div>
  );
}
