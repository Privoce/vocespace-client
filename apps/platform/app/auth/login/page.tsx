import { Suspense } from 'react';
import { AuthForm } from './form';
export default function Page() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
