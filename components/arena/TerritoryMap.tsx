'use client';

import { useEffect, useRef } from 'react';
import type { TerritoryData } from '@/lib/territory/types';
import 'leaflet/dist/leaflet.css';

export default function TerritoryMap({ territories, onSelect }: { territories: TerritoryData['territories']; onSelect: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const viewport = useRef<{ center: import('leaflet').LatLng; zoom: number } | null>(null);
  useEffect(() => {
    let disposed = false;
    let map: import('leaflet').Map | undefined;
    void import('leaflet').then(L => {
      if (disposed || !container.current) return;
      map = L.map(container.current, { scrollWheelZoom: false }).setView(viewport.current?.center ?? [49.684, 8.407], viewport.current?.zoom ?? 13);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
      const layers = L.featureGroup().addTo(map);
      for (const territory of territories) {
        const layer = L.geoJSON(territory.geometry, { style: { color: territory.mine ? '#f97316' : '#38bdf8', weight: 2, fillOpacity: 0.3 } });
        // Leaflet treats strings as HTML; use a text node for names from Strava.
        const label = document.createElement('span');
        label.textContent = `${territory.ownerName} · ${(territory.areaM2 / 1e6).toFixed(3)} km²`;
        layer.bindTooltip(label).on('click', () => onSelect(territory.id)).addTo(layers);
        layer.eachLayer(child => {
          const element = (child as import('leaflet').Path).getElement();
          if (!element) return;
          element.setAttribute('tabindex', '0');
          element.setAttribute('role', 'button');
          element.setAttribute('aria-label', label.textContent ?? 'Gebiet auswählen');
          element.addEventListener('keydown', event => {
            const key = (event as KeyboardEvent).key;
            if (key === 'Enter' || key === ' ') { event.preventDefault(); onSelect(territory.id); }
          });
        });
      }
      if (territories.length && !viewport.current) map.fitBounds(layers.getBounds(), { padding: [24, 24], maxZoom: 15 });
      const resize = new ResizeObserver(() => map?.invalidateSize());
      resize.observe(container.current);
      map.on('unload', () => resize.disconnect());
    });
    return () => { disposed = true; if (map) viewport.current = { center: map.getCenter(), zoom: map.getZoom() }; map?.remove(); };
  }, [territories, onSelect]);
  return <div ref={container} className="relative z-0 h-96 w-full rounded-2xl" aria-label="Revierkarte: Orange sind deine Gebiete, Blau die anderer Mitglieder" />;
}
