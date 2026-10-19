import { useState } from 'react';
import type { DemoAccountModel } from './useDemoAccount';
import { demoCredentials } from './config';
export function useAuthForm(account: DemoAccountModel) {
  const [email, setEmail] = useState(demoCredentials.email);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const submit = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 6) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (await account.authenticate(email, password, remember)) setPassword('');
  };
  return { email, setEmail, password, setPassword, remember, setRemember, invalid, submit };
}
