import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/playlists/$playlistId")({
  head: () => ({ meta: [{ title: "Focus Audio — Playlist" }] }),
  component: PlaylistDetail,
});

function MS({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols ${className}`} aria-hidden>{name}</span>;
}

const tracks = [
  { n: 1, title: "Submerged Frequencies", artist: "Echo Collective", album: "Benthic Zones Vol. 1", duration: "4:12" },
  { n: 2, title: "Cognitive Horizon", artist: "Neural Networks", album: "Synapse Sequences", duration: "7:05" },
  { n: 3, title: "Atmosphere 04", artist: "Blank Form", album: "Studies in Stillness", duration: "5:30" },
  { n: 4, title: "Tidal Lock", artist: "Orbital Mechanics", album: "Celestial Bodies", duration: "9:15" },
  { n: 5, title: "Driftwood", artist: "Mara Linde", album: "Coastal Studies", duration: "6:42" },
  { n: 6, title: "Lithic Pulse", artist: "Stone Garden", album: "Erosion", duration: "8:01" },
];

function PlaylistDetail() {
  return (
    <div>
      {/* Header */}
      <section
        className="px-10 pt-10 pb-8 relative overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 0% 0%, oklch(0.86 0.18 130 / 0.18), transparent 50%), radial-gradient(ellipse at 80% 30%, oklch(0.55 0.16 280 / 0.20), transparent 60%)",
        }}
      >
        <div className="flex flex-col md:flex-row gap-8 items-start md:items-end">
          <div
            className="size-48 md:size-56 rounded-xl border border-border shrink-0 grid place-items-center shadow-2xl"
            style={{
              background:
                "conic-gradient(from 45deg at 50% 50%, oklch(0.86 0.18 130 / 0.5), oklch(0.55 0.16 280 / 0.5), oklch(0.86 0.18 130 / 0.5))",
            }}
          >
            <MS name="queue_music" className="text-[64px] text-foreground/70" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-block text-[10px] text-accent font-semibold tracking-wider uppercase bg-accent/10 px-2.5 py-1 rounded-full">
              Public Playlist
            </span>
            <h1 className="font-display text-5xl md:text-6xl mt-3 leading-[1.02] text-balance">Deep Focus State</h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-2xl text-pretty">
              A curated selection of ambient textures and drone soundscapes designed to facilitate unbroken
              concentration and deep work sessions. Best enjoyed with noise-canceling headphones.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              <span className="text-foreground font-medium">Focus Audio Curators</span> • 42 tracks • 3 hr 45 min
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button className="size-14 rounded-full bg-accent text-accent-foreground grid place-items-center hover:scale-105 transition-transform shadow-lg shadow-accent/30">
            <MS name="play_arrow" className="text-[30px]" />
          </button>
          <button className="size-11 rounded-full border border-border text-muted-foreground hover:text-accent hover:border-accent grid place-items-center transition-colors">
            <MS name="favorite_border" className="text-[20px]" />
          </button>
          <button className="size-11 rounded-full border border-border text-muted-foreground hover:text-foreground grid place-items-center transition-colors">
            <MS name="more_horiz" className="text-[20px]" />
          </button>
        </div>
      </section>

      {/* Track list */}
      <section className="px-10 pb-12">
        <div className="grid grid-cols-[2rem_1fr_1fr_auto] gap-4 px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
          <span className="text-center">#</span>
          <span>Title</span>
          <span className="hidden md:block">Album</span>
          <span><MS name="schedule" className="text-[16px]" /></span>
        </div>
        <ul>
          {tracks.map((t) => (
            <li
              key={t.n}
              className="grid grid-cols-[2rem_1fr_1fr_auto] gap-4 px-4 py-3 rounded-lg items-center hover:bg-card/60 transition-colors group cursor-pointer"
            >
              <span className="text-center text-sm text-muted-foreground tabular-nums group-hover:hidden">{t.n}</span>
              <span className="text-center hidden group-hover:flex justify-center text-accent">
                <MS name="play_arrow" className="text-[20px]" />
              </span>
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-md bg-secondary shrink-0 grid place-items-center">
                  <MS name="music_note" className="text-[18px] text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-accent transition-colors">{t.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
                </div>
              </div>
              <p className="hidden md:block text-sm text-muted-foreground truncate">{t.album}</p>
              <p className="text-sm text-muted-foreground tabular-nums">{t.duration}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
