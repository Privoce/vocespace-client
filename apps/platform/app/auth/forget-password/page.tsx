import { Suspense } from 'react';
import { AuthForm } from '../login/form';
export default function Page() {
  return (
    <Suspense>
      <AuthForm initialMode="forgot" />
    </Suspense>
  );
}
