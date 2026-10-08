'use client';

import { PageFooter } from '@/components/PageFooter';
import { useNewSpace } from './hooks/UseNewSpace';
import { NewSpacePC } from './components/NewSpacePC';

export default function Page() {
  const hookProps = useNewSpace();

  return (
    <>
      <NewSpacePC {...hookProps} />
      <PageFooter loading={hookProps.loading}></PageFooter>
    </>
  );
}
