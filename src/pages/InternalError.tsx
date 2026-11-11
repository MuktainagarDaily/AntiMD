import ErrorPage from '@/components/shared/ErrorPage';

export default function InternalError() {
  return <ErrorPage code={500} />;
}
