import ErrorPage from '@/components/shared/ErrorPage';

export default function BadGateway() {
  return <ErrorPage code={502} />;
}
