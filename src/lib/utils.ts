import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns true only if `raw` parses as an http(s) URL.
 * Use this before rendering admin-provided values into `href`
 * attributes to prevent `javascript:`/`data:` XSS.
 */
export function isSafeHttpUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  try {
    const u = new URL(trimmed);
    return (u.protocol === 'http:' || u.protocol === 'https:') && Boolean(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Validates a post-sign-in `next` redirect target. Must be a
 * same-origin relative path (`/foo`), never `//evil`, `/\evil`,
 * double-encoded payloads (`%2F%2F`), protocol-relative,
 * or an absolute URL. Returns the normalized path or `null` if unsafe.
 */
export function safeRelativePath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;

  let decoded = raw.trim();
  try {
    // Decode double-encoded payloads (e.g. %2F%2Fevil.com)
    while (decoded.includes('%')) {
      const prev = decoded;
      decoded = decodeURIComponent(decoded);
      if (prev === decoded) break;
    }
  } catch {
    return null;
  }

  // Must begin with a single forward slash
  if (!decoded.startsWith('/')) return null;

  // Reject protocol-relative URLs (//, /\, \/)
  if (decoded.startsWith('//') || decoded.startsWith('/\\') || decoded.startsWith('\\')) {
    return null;
  }

  // Reject external protocols in the pathname (e.g. /http:, /javascript:, etc.)
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)) {
    return null;
  }

  return decoded;
}

/** Loose Indian mobile validator: 10 digits starting 6–9, with optional 0/91 prefix. */
export function isValidIndianPhone(raw: string): boolean {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return true;
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) return true;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) return true;
  return false;
}

/** Shared text-input Tailwind class used across admin + request forms. */
export const inputCls =
  'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm';

/** Hosts treated as "this app" — ad links to them stay in the same tab/PWA window. */
const INTERNAL_HOSTS = ['apnatownn.lovable.app'];

/** Returns a same-origin relative path (`/x?y#z`) if `raw` points into this app, else null. */
export function getInternalNavPath(raw: unknown): string | null {
  if (!isSafeHttpUrl(raw)) return null;
  try {
    const u = new URL(raw.trim());
    const here = typeof window !== 'undefined' ? window.location.host : '';
    const internal = (u.protocol === 'https:' && INTERNAL_HOSTS.includes(u.host)) || (here && u.host === here);
    return internal ? (u.pathname || '/') + u.search + u.hash : null;
  } catch {
    return null;
  }
}
