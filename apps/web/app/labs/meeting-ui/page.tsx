'use client';

import dynamic from 'next/dynamic';
const Preview = dynamic(() => import('./preview'), { ssr: false });
export default function Page() {
  return <Preview />;
}
