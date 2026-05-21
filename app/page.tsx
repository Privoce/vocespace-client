'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// 直接跳转到new_space页面
export default function Page() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/new_space');
  }, [router]);

  return null;
}
