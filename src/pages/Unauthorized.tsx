import ErrorPage from '@/components/shared/ErrorPage';

export default function Unauthorized() {
  return <ErrorPage code={401} />;
}
