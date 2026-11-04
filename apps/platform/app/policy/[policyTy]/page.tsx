import { notFound, redirect } from 'next/navigation';
import { legalDocuments } from '@vocespace/i18n/legal-documents';
import { LegalReader } from '../../../components/legal/LegalReader';

export default function Page({ params }: { params: { policyTy: string } }) {
  if (params.policyTy === 'teams') redirect('/policy/terms');
  if (params.policyTy !== 'privacy' && params.policyTy !== 'terms') notFound();
  return <LegalReader markdown={legalDocuments[params.policyTy]} />;
}
