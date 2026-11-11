import { useParams } from 'react-router-dom';
import ErrorPage, { type ErrorCode } from '@/components/shared/ErrorPage';

const VALID_CODES: ErrorCode[] = [400, 401, 403, 404, 500, 502, 503];

/**
 * Single dynamic error route: `/error/:code` (e.g. `/error/404`, `/error/500`).
 * Replaces the per-status wrapper pages (BadRequest, Unauthorized, …).
 * Falls back to 404 for unknown codes so bad links still render something useful.
 */
export default function ErrorRoute() {
  const { code } = useParams<{ code: string }>();
  const parsed = Number(code) as ErrorCode;
  const resolved: ErrorCode = VALID_CODES.includes(parsed) ? parsed : 404;
  return <ErrorPage code={resolved} />;
}