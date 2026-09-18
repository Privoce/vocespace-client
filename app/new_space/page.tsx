'use client';

import { useHomePage } from '@/features/home/hooks/use-home-page';
import { HomePagePC } from '@/features/home/views/pc';
import { HomePagePhone } from '@/features/home/views/phone';

export default function Page() {
  const model = useHomePage();
  return model.device === 'phone' ? <HomePagePhone {...model} /> : <HomePagePC {...model} />;
}
