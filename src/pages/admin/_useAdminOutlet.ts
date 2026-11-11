import { useOutletContext } from 'react-router-dom';

interface InboxStats { pending: number; claims: number; total: number }
interface Ctx { inboxStats?: InboxStats }

export function useAdminOutletInbox(): InboxStats {
  const ctx = useOutletContext<Ctx>() ?? {};
  return ctx.inboxStats ?? { pending: 0, claims: 0, total: 0 };
}
