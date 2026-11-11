import ErrorPage from '@/components/shared/ErrorPage';

export default function ServiceUnavailable() {
  return <ErrorPage code={503} />;
}
