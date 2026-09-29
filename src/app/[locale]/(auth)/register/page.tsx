import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AuthCard } from '@/components/auth/auth-card';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth'))('registerTitle') };
}

export default function RegisterPage() {
  return <AuthCard mode="register" />;
}
