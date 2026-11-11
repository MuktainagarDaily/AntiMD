import ErrorPage from '@/components/shared/ErrorPage';

export default function BadRequest() {
  return <ErrorPage code={400} />;
}
