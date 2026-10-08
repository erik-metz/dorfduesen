import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

export default function CoachPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 text-zinc-500 flex items-center justify-center p-8">Lade Smart Coach...</div>}>
      <CoachRedirect />
    </Suspense>
  );
}

async function CoachRedirect() {
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    redirect('/dashboard');
  }

  redirect('/dashboard?tab=coach');
  return null;
}
