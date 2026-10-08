import { getClubData } from '@/lib/data/club';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { StatsBar } from '@/components/StatsBar';
import { SpiritSection } from '@/components/SpiritSection';
import { SundayRunSection } from '@/components/SundayRunSection';
import { PostGallery } from '@/components/PostGallery';
import { StravaSection } from '@/components/StravaSection';
import { FaqSection } from '@/components/FaqSection';
import { Footer } from '@/components/Footer';

export default async function HomePage() {
  const club = await getClubData();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-orange-600 selection:text-white">
      {/* Sticky Navigation */}
      <Navbar club={club} />

      {/* Main Content Sections */}
      <main className="flex-1">
        <Hero club={club} />
        <StatsBar club={club} />
        <SpiritSection club={club} />
        <SundayRunSection club={club} />
        <PostGallery posts={club.posts} instagramUrl={club.instagramUrl} />
        <StravaSection club={club} />
        <FaqSection club={club} />
      </main>

      {/* Footer */}
      <Footer club={club} />
    </div>
  );
}
