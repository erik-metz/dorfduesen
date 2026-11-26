import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Flame } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { getAccessOverview, isAdmin } from '@/lib/admin/access';
import { AdminPanel } from '@/components/admin/AdminPanel';

export const metadata = {
  title: 'Mitgliederverwaltung | Dorfdüsen Nordheim',
  robots: { index: false, follow: false },
};

function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
      <div className="flex items-center gap-3 text-orange-500 font-bold">
        <Flame className="w-6 h-6 animate-pulse fill-orange-500" />
        <span>Lade Mitgliederverwaltung …</span>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-black">Kein Zugriff</h1>
        <p className="text-sm text-zinc-400">Diese Seite ist nur für Club-Admins.</p>
        <Link href={user ? '/dashboard' : '/'} className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Zurück
        </Link>
      </div>
    );
  }

  const overview = await getAccessOverview();
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="space-y-2">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <h1 className="text-3xl font-black tracking-tight">Mitgliederverwaltung</h1>
          <p className="text-sm text-zinc-400">
            Nur freigegebene Mitglieder können sich anmelden. Neue Anfragen erscheinen hier und als Push-Benachrichtigung in der App.
          </p>
        </div>
        <AdminPanel initialOverview={overview} currentUserId={user!.id} />
      </div>
    </div>
  );
}
