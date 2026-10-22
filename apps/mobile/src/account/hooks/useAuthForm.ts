import { useState } from 'react';
import type { AccountModel } from './useAccount';
export function useAuthForm(account: AccountModel) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const submit = async () => {
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      password.length < (account.screen === 'register' ? 8 : 1)
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (await account.authenticate(email, password, remember)) setPassword('');
  };
  const forgot = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    await account.forgot(email);
  };
  return { forgot, email, setEmail, password, setPassword, remember, setRemember, invalid, submit };
}
