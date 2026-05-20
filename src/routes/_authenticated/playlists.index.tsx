import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-shell";

export const Route = createFileRoute("/_authenticated/playlists/")({
  head: () => ({ meta: [{ title: "Focus Audio — Playlists" }] }),
  component: PlaylistsIndex,
});

const playlists = [
  { id: "deep-focus-state", title: "Deep Focus State", curator: "Focus Audio Curators", tracks: 42 },
  { id: "morning-ambient", title: "Morning Ambient", curator: "Focus Audio", tracks: 28 },
  { id: "flow-state", title: "Flow State", curator: "Focus Audio", tracks: 35 },
  { id: "study-sonata", title: "Study Sonata", curator: "Focus Audio", tracks: 24 },
  { id: "night-drive", title: "Night Drive", curator: "Focus Audio", tracks: 31 },
  { id: "cinematic", title: "Cinematic Soundscapes", curator: "Focus Audio", tracks: 19 },
];

function PlaylistsIndex() {
  return (
    <div>
      <PageHeader eyebrow="Your selections" title="Playlists" subtitle="Curated mixes, smart shuffle, deep work sessions." />
      <div className="px-10 pb-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
        {playlists.map((p, i) => (
          <Link
            key={p.id}
            to="/playlists/$playlistId"
            params={{ playlistId: p.id }}
            className="group cursor-pointer"
          >
            <div
              className="relative w-full aspect-square rounded-xl overflow-hidden border border-border grid place-items-center"
              style={{
                background: `linear-gradient(${135 + i * 25}deg, oklch(0.${35 + i * 4} 0.${10 + i * 2} ${100 + i * 40}), oklch(0.${20 + i * 2} 0.${4 + i} ${260 + i * 20}))`,
              }}
            >
              <span className="material-symbols text-[44px] text-foreground/40" aria-hidden>queue_music</span>
              <span className="absolute bottom-3 right-3 size-11 rounded-full bg-accent text-accent-foreground grid place-items-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-lg shadow-accent/30">
                <span className="material-symbols text-[24px]" aria-hidden>play_arrow</span>
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold leading-tight">{p.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{p.curator} • {p.tracks} tracks</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
