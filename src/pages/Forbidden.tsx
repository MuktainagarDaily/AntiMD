import ErrorPage from '@/components/shared/ErrorPage';

export default function Forbidden() {
  return <ErrorPage code={403} />;
}
