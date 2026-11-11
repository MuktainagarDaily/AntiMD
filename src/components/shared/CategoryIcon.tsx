import {
  Pill,
  UtensilsCrossed,
  Shirt,
  Wrench,
  Croissant,
  Milk,
  BookOpen,
  ShoppingCart,
  Smartphone,
  Carrot,
  IceCreamCone,
  Settings,
  Home,
  Car,
  Store,
  type LucideIcon,
} from 'lucide-react';

/**
 * Maps category names (case-insensitive, partial match) to Lucide icons.
 * Categories are dynamic — admin can create any name — so we match by keyword
 * and fall back to a generic Store icon so nothing ever renders as a tofu □.
 */
const KEYWORD_MAP: Array<[RegExp, LucideIcon]> = [
  [/medic|pharma|chem/i, Pill],
  [/restaur|hotel|dhaba|food court/i, UtensilsCrossed],
  [/cloth|garment|tailor|fashion|boutique/i, Shirt],
  [/hardware|tool|paint/i, Wrench],
  [/bakery|cake|bread/i, Croissant],
  [/dairy|milk/i, Milk],
  [/station|book|xerox|print/i, BookOpen],
  [/grocery|kirana|supermark/i, ShoppingCart],
  [/electronic|mobile|phone|computer|laptop/i, Smartphone],
  [/veget|fruit|sabji/i, Carrot],
  [/snack|beverag|cold drink|juice|ice ?cream/i, IceCreamCone],
  [/auto|car|bike|vehicle|spare/i, Car],
  [/home|living|furniture|decor/i, Home],
  [/service|repair|saloon|salon/i, Settings],
];

export function categoryIconFor(name?: string | null): LucideIcon {
  if (!name) return Store;
  for (const [re, Icon] of KEYWORD_MAP) {
    if (re.test(name)) return Icon;
  }
  return Store;
}

interface CategoryIconProps {
  name?: string | null;
  className?: string;
  size?: number;
  strokeWidth?: number;
  'aria-hidden'?: boolean;
}

export function CategoryIcon({
  name,
  className,
  size,
  strokeWidth = 2,
  ...rest
}: CategoryIconProps) {
  const Icon = categoryIconFor(name);
  return (
    <Icon
      className={className}
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden={rest['aria-hidden'] ?? true}
    />
  );
}
