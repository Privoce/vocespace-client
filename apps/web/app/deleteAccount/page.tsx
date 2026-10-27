import type { Metadata } from 'next';
import { DeleteAccountContent } from './content';
export const metadata: Metadata = {
  title: 'Delete account | VoceSpace',
  description: 'Sign in to delete your VoceSpace account and associated data.',
};
export default function DeleteAccountPage() {
  return <DeleteAccountContent />;
}
