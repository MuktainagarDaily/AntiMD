import { useMemo } from 'react';
import { buildHighlightTokens, highlightParts } from '@/lib/fuzzySearch';

interface Props {
  text: string | null | undefined;
  query: string;
  className?: string;
}

/**
 * Renders `text` with literal occurrences of the query tokens wrapped in a
 * highlighted <mark>. Case-insensitive; works for EN and MR strings.
 */
export function HighlightedText({ text, query, className }: Props) {
  const tokens = useMemo(() => buildHighlightTokens(query), [query]);
  const parts = useMemo(() => highlightParts(text || '', tokens), [text, tokens]);

  if (!text) return null;
  if (!tokens.length) return <span className={className}>{text}</span>;

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.match ? (
          <mark
            key={i}
            className="bg-secondary/40 text-foreground rounded-sm px-0.5"
            style={{ backgroundColor: 'hsl(var(--secondary) / 0.35)' }}
          >
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}
