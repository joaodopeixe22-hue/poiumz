# Biblioteca Musical: Upload MP3 + Gerenciamento

Implementação completa das Etapas 1–10 do escopo, integrando com o design system "Focus Audio" já em uso e o `usePlayerStore` existente.

---

## 1. Backend (Lovable Cloud)

### Storage
- Bucket **privado** `tracks` — arquivos de áudio (path: `{user_id}/{track_id}.{ext}`).
- Bucket **público** `covers` — capas extraídas (path: `{user_id}/{track_id}.jpg`).
- Políticas RLS: cada usuário só lê/escreve dentro do seu próprio prefixo `{user_id}/`.

### Tabelas (migration única)
- `tracks` — `id, user_id, title, artist, album, genre, year, duration, bitrate, track_number, cover_url, file_path, file_size, mime_type, play_count, last_played_at, is_favorite, created_at, updated_at`.
- `folders` — `id, user_id, name, color, created_at`.
- `track_folders` — junção `track_id ↔ folder_id`.
- `track_tags` — `id, track_id, user_id, tag` (tags livres tipo "foco", "treino").
- Índices em `user_id`, `(user_id, created_at desc)`, GIN trigram em `title/artist/album` para busca.
- Trigger `set_updated_at` reutilizando função existente.
- RLS: dono completo (CRUD), nada público.

### URLs assinadas
Server function `getTrackSignedUrl(trackId)` → URL temporária de 1h para reprodução. Capas usam URL pública direta.

---

## 2. Upload + Metadados (client-side)

Toda a extração de metadados acontece no **browser** antes do upload (evita Worker runtime + dá feedback imediato):

- `music-metadata-browser` → título, artista, álbum, gênero, ano, track#, duração, bitrate, capa embutida.
- Validação: extensões `mp3/flac/wav/m4a/aac`, MIME real (magic bytes), tamanho máx **50 MB** por arquivo, máx **20 arquivos** por lote.
- Fluxo por arquivo:
  1. Validar tipo/tamanho.
  2. Parsear metadados + extrair capa (blob).
  3. Upload do áudio → Storage `tracks/{user_id}/{uuid}.{ext}`.
  4. Upload da capa (se existir) → `covers/{user_id}/{uuid}.jpg`.
  5. `INSERT` em `tracks` com metadados.
  6. Fallback: se faltar título, usa nome do arquivo; se faltar capa, gradiente gerado.

### Componente `UploadDropzone`
- Drag-and-drop + botão "Selecionar arquivos".
- Lista de progresso por arquivo: nome, % barra, status (parsing → uploading → saving → done/error), velocidade aproximada, botão remover/retry.
- Concorrência: 3 uploads paralelos (fila).

---

## 3. Rotas e telas

Substituir/expandir as rotas já existentes (mantendo layout `_authenticated` e `GlobalPlayer`):

| Rota | Função |
|---|---|
| `/library` (já existe — substituir ComingSoon) | Hub com tabs: Músicas, Álbuns, Artistas, Recentes, Favoritos, Pastas |
| `/library/upload` (novo) | Tela dedicada de upload com dropzone grande |
| `/library/track/$trackId` (novo) | Drawer/modal de detalhes + edição de metadados |
| `/downloads` (já existe — substituir) | Lista de uploads recentes (últimos 30 dias) |

### `/library` — visual
- Header com busca instantânea (debounce 200ms) + botão "Upload".
- Tabs (Radix) para as 6 seções.
- **Músicas**: tabela virtualizada (`@tanstack/react-virtual`) com colunas `#`, Título+Artista, Álbum, Gênero, Duração, ações. Seleção múltipla via checkbox + shift-click.
- **Álbuns / Artistas**: grid de cards (capa + nome + contagem).
- **Recentes**: ordenado por `created_at desc`, primeiras 50.
- **Favoritos**: filtro `is_favorite=true`.
- **Pastas**: grid de pastas + criar nova (modal).

### Toolbar de seleção múltipla
Aparece sticky no rodapé quando ≥1 selecionada: **Tocar agora**, **Adicionar à fila**, **Adicionar à pasta**, **Favoritar**, **Excluir**.

### Edição de metadados
Drawer lateral (Sheet) com formulário: título, artista, álbum, gênero, ano, track#, upload de nova capa, tags (chips). Botões "Reprocessar metadados" (re-parse do arquivo) e "Salvar".

---

## 4. Player local

Integração com `usePlayerStore` (já existente):
- Ao clicar play em uma track, server fn devolve URL assinada e seta `currentTrack` com `src`.
- `GlobalPlayer` precisa de um `<audio>` real (hoje só renderiza UI). Adicionar `<AudioEngine />` montado em `_authenticated.tsx`:
  - Reage a `currentTrack`, `playbackState`, `volume`, `muted`, `position`.
  - Eventos `timeupdate` → `setPosition`; `ended` → `next()`.
  - Crossfade (2/5/10s): dois elementos `<audio>` alternados.
  - Equalizador via `AudioContext` + `BiquadFilterNode` (bass/mid/treble) — aplicado quando ≠ flat.
- `play_count` e `last_played_at` incrementados via server fn ao completar 30s de reprodução.

Multi-device sync e smart queue ficam como hooks instalados mas com implementação básica (registrar device em `localStorage`, smart queue = continuar do mesmo álbum/artista).

---

## 5. Organização e filtros

- **Tags**: input com sugestões das tags já usadas, criação livre.
- **Pastas**: relação N:N, drag-and-drop de tracks para pasta na sidebar.
- **Filtros** (popover): gênero (multi-select), duração (slider min/max), bitrate (≥128/≥256/≥320), apenas favoritos.
- **Ordenação**: dropdown — Recente / Nome / Artista / Duração / Mais tocadas.
- **Busca**: full-text sobre `title/artist/album/genre` via `ilike` + trigram.

---

## 6. Performance

- Virtualização (`@tanstack/react-virtual`) para listas >100 itens.
- Capas com `loading="lazy"` + `IntersectionObserver` para pré-carregar 10 acima/abaixo do viewport.
- Cache de queries com `@tanstack/react-query` (já instalado): chave por `[tracks, filters, sort]`, invalidação após mutações.
- Upload assíncrono não bloqueia navegação (estado global em Zustand `useUploadStore`).
- URLs assinadas cacheadas em memória por 50min.

---

## 7. Segurança

- Validação dupla: tipos MIME no client + check de extensão no server fn de delete (impede path traversal).
- Tamanho máx 50MB enforced no client; Storage bucket configurado com limite.
- RLS bloqueia leitura cruzada entre usuários.
- Server fn de delete usa `requireSupabaseAuth` + verifica `user_id` antes de remover storage object.
- Nomes de arquivo gerados via `crypto.randomUUID()` — nunca o original.

---

## 8. Arquivos a criar/editar

**Migration (1)**: `supabase/migrations/{ts}_library_setup.sql` — buckets, tabelas, RLS, índices, triggers.

**Server functions** (`src/lib/library.functions.ts`):
- `listTracks(filters, sort)`, `getTrackSignedUrl(id)`, `updateTrack(id, patch)`, `deleteTracks(ids[])`, `toggleFavorite(id)`, `incrementPlayCount(id)`, `listFolders`, `createFolder`, `addToFolder`, `listTags`.

**Stores**:
- `src/stores/upload-store.ts` — fila de uploads + progresso.
- `src/stores/library-store.ts` — filtros/ordenação/seleção.

**Componentes** (`src/components/library/`):
- `upload-dropzone.tsx`, `upload-queue.tsx`, `track-table.tsx`, `track-row.tsx`, `album-grid.tsx`, `artist-grid.tsx`, `folder-grid.tsx`, `track-edit-sheet.tsx`, `selection-toolbar.tsx`, `library-filters.tsx`, `cover-image.tsx` (lazy), `audio-engine.tsx`.

**Hooks**: `src/hooks/use-metadata-parser.ts`, `src/hooks/use-track-upload.ts`, `src/hooks/use-library-query.ts`.

**Rotas**:
- editar `src/routes/_authenticated/library.tsx` (hub com tabs).
- novo `src/routes/_authenticated/library.upload.tsx`.
- editar `src/routes/_authenticated/downloads.tsx` (uploads recentes).
- editar `src/routes/_authenticated.tsx` (montar `<AudioEngine />`).

**Dependências** (`bun add`):
- `music-metadata-browser`
- `@tanstack/react-virtual`
- `react-dropzone`

---

## 9. Fora de escopo (confirmando)

Não implementar: compartilhamento social, comentários, feed, marketplace, pagamentos, transcoding server-side (FFmpeg fica só como fallback futuro — não bloqueia esta entrega).

---

## Perguntas antes de implementar

1. **Tamanho máx por arquivo**: 50 MB ok, ou prefere outro limite? (FLAC longos podem passar disso.)
2. **Equalizador na Etapa 5**: implementação completa agora ou stub visual que conecta nos próximos sprints? (Implementação completa adiciona ~1–2 arquivos a mais.)
3. **Smart queue / Multi-device sync** (Etapa 5): versão básica (continuar álbum + registrar device atual) é suficiente, ou precisa sync realtime entre dispositivos via Supabase Realtime? Sync realtime expande bem o escopo.
