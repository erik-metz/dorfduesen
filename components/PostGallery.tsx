'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ExternalLink, Heart, Layers } from 'lucide-react';
import { InstagramIcon } from '@/components/icons/BrandIcons';
import { ClubPost } from '@/types/club';

interface PostGalleryProps {
  posts: ClubPost[];
  instagramUrl: string;
}

function PostCard({ post, instagramUrl }: { post: ClubPost; instagramUrl: string }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const hasMultipleImages = post.images.length > 1;

  const nextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlide((prev) => (prev + 1) % post.images.length);
  };

  const prevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlide((prev) => (prev - 1 + post.images.length) % post.images.length);
  };

  const cleanCaption = post.caption.trim();

  return (
    <div className="rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden flex flex-col justify-between hover:border-zinc-700 transition-all shadow-xl">
      {/* Post Image Container */}
      <div className="relative aspect-square w-full bg-zinc-950 overflow-hidden group">
        {post.images.length > 0 ? (
          <Image
            src={post.images[currentSlide]}
            alt={`Dorfdüsen Impression Slide ${currentSlide + 1}`}
            fill
            className="object-cover group-hover:scale-102 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600">
            Kein Bild verfügbar
          </div>
        )}

        {/* Carousel controls */}
        {hasMultipleImages && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
              aria-label="Vorheriges Bild"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
              aria-label="Nächstes Bild"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Slide counter pill */}
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-[11px] font-bold text-white flex items-center gap-1.5 shadow-md">
              <Layers className="w-3 h-3 text-orange-400" />
              <span>
                {currentSlide + 1} / {post.images.length}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Caption & Metadata */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-400 flex items-center gap-1">
              <InstagramIcon className="w-3.5 h-3.5" /> @dorfduesen
            </span>
            <div className="flex items-center gap-1 text-xs text-zinc-400">
              <Heart className="w-3.5 h-3.5 text-zinc-500" />
              <span>Community</span>
            </div>
          </div>

          {/* Caption text */}
          {cleanCaption && (
            <div>
              <p
                className={`text-xs sm:text-sm text-zinc-300 whitespace-pre-line leading-relaxed ${
                  !isExpanded ? 'line-clamp-4' : ''
                }`}
              >
                {cleanCaption}
              </p>
              {cleanCaption.length > 180 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs font-semibold text-orange-400 hover:text-orange-300 mt-1 cursor-pointer"
                >
                  {isExpanded ? 'Weniger anzeigen' : 'Mehr lesen...'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Action Link to Instagram */}
        <div className="pt-4 mt-4 border-t border-zinc-800/80 flex items-center justify-between">
          <span className="text-xs text-zinc-400">Live aus Nordheim</span>
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold text-zinc-300 hover:text-white transition-colors"
          >
            <span>Auf Instagram</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

export function PostGallery({ posts, instagramUrl }: PostGalleryProps) {
  return (
    <section id="feed" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-600/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider">
              <InstagramIcon className="w-3.5 h-3.5" /> Echte Momente & Wettkämpfe
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
              Der Dorfdüsen Feed
            </h2>
            <p className="text-base sm:text-lg text-zinc-300">
              Von gemeinsamen Sonntagsrunden bis hin zu eskalierten Stadtläufen in Bürstadt und Lampertheim: 
              Hier sind die aktuellen Eindrücke der Dorfdüsen.
            </p>
          </div>

          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700/80 transition-all shrink-0 self-start md:self-auto"
          >
            <InstagramIcon className="w-4 h-4 text-orange-500" />
            <span>@dorfduesen auf Instagram folgen</span>
          </a>
        </div>

        {/* Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} instagramUrl={instagramUrl} />
          ))}
        </div>

        {/* Bottom Banner */}
        <div className="mt-12 text-center p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 max-w-xl mx-auto">
          <p className="text-sm text-zinc-300">
            Willst du beim nächsten Lauf auf den Fotos dabei sein?
          </p>
          <a
            href="#sonntagsrunde"
            className="inline-block mt-2 text-sm font-bold text-orange-400 hover:text-orange-300 underline underline-offset-4"
          >
            Komm nächsten Sonntag einfach mit! →
          </a>
        </div>
      </div>
    </section>
  );
}
