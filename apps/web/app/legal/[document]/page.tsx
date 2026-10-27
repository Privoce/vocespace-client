import { notFound } from 'next/navigation';
import { LegalReader } from './reader';
export function generateStaticParams() {
  return [{ document: 'privacy' }, { document: 'terms' }];
}
export default async function LegalPage({ params }: { params: Promise<{ document: string }> }) {
  const { document } = await params;
  if (document !== 'privacy' && document !== 'terms') notFound();
  return <LegalReader documentId={document} />;
}
