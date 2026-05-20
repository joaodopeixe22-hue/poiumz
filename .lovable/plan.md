# Plataforma de Streaming Musical — Roadmap Completo

Plano de execução em 10 etapas. Após aprovação, vou primeiro gerar 3 direções visuais (Spotify-like / Plexamp-like / minimal premium dark) e só depois começar a Etapa 1. Cada etapa termina em estado utilizável; nada é deixado pela metade.

---

## Stack confirmada
- **Frontend:** TanStack Start (template Lovable) + React + TS + Tailwind + Zustand + Framer Motion + TanStack Query
- **Backend:** Lovable Cloud (Supabase) — Auth, Postgres, Realtime, Storage
- **Áudio:** HTML5 Audio + Web Audio API
- **PWA:** manifest only (sem service worker — preview iframe quebra com SW)
- **Sem yt-dlp:** uploads MP3 manuais via Storage (decidido)

---

## Etapa 1 — Auth + Estrutura Global

**Schema:**
- `profiles` (id→auth.users, username, display_name, avatar_url, bio, preferences jsonb) + trigger auto-create + RLS
- `user_roles` (id, user_id, role enum) + função `has_role()` SECURITY DEFINER

**UI:**
- Rotas: `/login`, `/signup`, `/forgot-password`, `/reset-password` (públicas)
- `_authenticated` layout route com `beforeLoad` guard
- Rotas autenticadas: `/` (Home), `/explore`, `/radios`, `/playlists`, `/library`, `/downloads`, `/settings`
- Sidebar colapsável (shadcn sidebar) + header + slot do Player global fixo (bottom)
- Dark mode premium tokens em `src/styles.css` (oklch)

**Store Zustand global** (`usePlayerStore`): currentTrack, queue, history, currentDevice, playbackState, volume, eqSettings, repeat, shuffle — com persistência em localStorage.

**Auth:** email/password + Google (via broker Lovable + `configure_social_auth`). `onAuthStateChange` no `__root.tsx` invalidando router/query.

---

## Etapa 2 — Player Profissional

**Schema:** `queue_state`, `player_state` (por device), `play_history`.

**Componentes:**
- `<GlobalPlayer />` fixo: play/pause, seek slider, volume, prev/next, repeat (off/all/one), shuffle, capa, título, artista
- `<QueuePanel />` (Sheet lateral): reordenar (dnd-kit), "tocar a seguir", remover, limpar
- `<MiniPlayer />` flutuante minimizável (Framer Motion)
- Smart Queue: prioridade manual + auto-fill por similaridade
- Crossfade 2/5/10s via dois `<audio>` elements + GainNode
- Replay inteligente: salva position a cada 5s em `player_state`
- Atalhos: Space, ←/→, ↑/↓, M, S, R, N, P, F

---

## Etapa 3 — Streaming e Rádios

**Schema:** `radio_stations` (cache local), `radio_favorites`.

- Diretório via **Radio Browser API** (pública, sem key) — filtros por gênero, país, idioma, busca
- Player tolerante a stream (reconnect automático, fallback de URL)
- Rádio infinita: ao terminar/parar uma estação, sugere similar por tags
- Auto-DJ: edge/server-fn que monta próxima fila baseada em (gênero + energia + tags) das últimas N faixas
- Pré-buffer com `<audio preload="auto">` da próxima

---

## Etapa 4 — Playlists Avançadas

**Schema:** `tracks`, `playlists` (is_public bool), `playlist_items` (ordered), `playlist_folders`, `tags`, `playlist_tags`, `favorites`.

**RLS:** SELECT público se `is_public=true`; INSERT/UPDATE/DELETE só do dono.

**UI:**
- CRUD de playlists + pastas (drag to organize)
- Tags presets: estudo, treino, relaxamento, foco + custom
- Library com filtros avançados + busca dinâmica (TanStack Query + debounce)
- Shuffle inteligente (Fisher–Yates sem repetição)
- Estatísticas: `playlist_stats` view materializada (plays, top tracks, tempo total)

---

## Etapa 5 — Multi-Dispositivo

**Schema:** `devices` (id, user_id, name, type, last_seen, is_active), `device_state` (realtime).

- Cada aba/cliente registra device no login com nanoid persistido
- Supabase Realtime channel `player:{user_id}` broadcasta: play, pause, seek, track_change, queue_update
- Device manager em `/settings/devices` — lista + "transferir reprodução"
- Apenas um device "ativo" reproduz áudio; outros viram controle remoto
- Transferência: novo device assume state atual (track + position + queue) e o antigo pausa

---

## Etapa 6 — Qualidade de Áudio

- Web Audio API: `MediaElementSource` → BiquadFilters (bass/mid/treble) → GainNode (boost) → DynamicsCompressor (normalização) → Destination
- Perfis: Bass Boost, Vocal, Focus, Cinema, Flat + custom
- Settings persistidas em `profiles.preferences`
- UI: `/settings/audio` com sliders e visualização

---

## Etapa 7 — Upload e Biblioteca (sem yt-dlp)

**Schema:** `tracks` (id, user_id, title, artist, album, duration, file_path, cover_path, metadata jsonb).

- Upload MP3/FLAC/WAV via Supabase Storage (bucket `tracks` privado + signed URLs; `covers` público)
- Parse de metadata client-side com `music-metadata-browser` (título, artista, álbum, duração, capa embarcada)
- Drag-and-drop com progress + batch upload
- Validações: tipo MIME, tamanho (ex: 50MB/arquivo), sanitização de nome
- Auto-add à biblioteca; capa extraída → upload para `covers`

---

## Etapa 8 — Embeds Externos

- Página `/explore` com Tabs: SoundCloud / Spotify / YouTube
- Iframes oficiais (sem scraping), busca client-side via inputs
- Renderização condicional (só monta iframe ativo)
- Transições Framer Motion entre tabs
- **Importante:** áudio dos embeds não passa pelo Web Audio nem pelo Player global (limitação dos iframes)

---

## Etapa 9 — Performance & PWA

- TanStack Query com `staleTime` agressivo para capas/playlists
- Cache HTTP de covers via signed URLs longas
- `react-virtuoso` para listas >100 itens (biblioteca, queue, playlists)
- Lazy-load de rotas (já automático no TanStack Start)
- Skeleton loading em todos os fetches
- Pré-carrega próxima track 15s antes do fim
- Reconexão automática de streams (exponential backoff)
- **PWA manifest-only:** `manifest.json` + ícones + `display: standalone` (instalável, sem SW por causa do preview iframe)

---

## Etapa 10 — UX Premium

- Micro-animações Framer Motion (page transitions, hover, drag)
- Modo Foco (`/focus`): tela cheia escura só com capa + waveform + controles
- Fullscreen Player com capa gigante + letra (placeholder por enquanto)
- Picture-in-Picture para iframe YouTube (Document PiP API quando disponível)
- Feedback visual instantâneo (otimistic updates via TanStack Query)
- Skeletons + transições suaves entre rotas

---

## Banco de Dados — Resumo

```text
profiles, user_roles
tracks, favorites, playlists, playlist_items, playlist_folders, tags, playlist_tags
player_state, queue_state, devices, device_state, play_history
radio_stations, radio_favorites
playlist_stats (view), track_stats (view)
```

Todas com RLS habilitada; políticas escopadas por `auth.uid()` ou `is_public=true` para reads.

---

## Segurança

- RLS em 100% das tabelas
- Roles via `user_roles` + `has_role()` SECURITY DEFINER (nunca em `profiles`)
- Validação Zod em todos os server functions
- Upload: MIME + tamanho + sanitização de nome
- Rate-limit em server functions sensíveis (Auto-DJ, search)
- HIBP password check ativado

---

## Direções visuais (antes da Etapa 1)

Vou gerar 3 direções rendered HTML com `design--create_directions`:
1. **Spotify-like** — verde-escuro, denso, sidebar larga, cards
2. **Plexamp-like** — minimal preto puro, foco em capas grandes, gradientes da arte
3. **Minimal Premium** — neutro escuro, tipografia editorial, muito whitespace

Você escolhe uma e implemento toda a UI em cima dela (tokens copiados verbatim).

---

## Ordem de entrega proposta

1. Direções visuais → escolha
2. Etapa 1 (Auth + estrutura) — entregável navegável
3. Etapa 4 (Playlists/tracks) antes da 2 — precisa de dados pra player ter o que tocar
4. Etapa 7 (Upload) — alimenta a biblioteca
5. Etapa 2 (Player completo)
6. Etapa 6 (EQ/áudio)
7. Etapa 3 (Rádios)
8. Etapa 5 (Multi-device) — depende do player sólido
9. Etapa 8 (Embeds)
10. Etapa 9 (Perf/PWA) + Etapa 10 (UX premium) — polimento final

Aprove e eu começo gerando as 3 direções visuais.
