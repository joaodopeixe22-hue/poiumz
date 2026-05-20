
# Upload em massa + gerenciamento em lote

Extende a biblioteca existente (`tracks`, `folders`, `track_tags`) com playlists reais, upload massivo resiliente, seleção múltipla e ações em lote. Mantém o visual Focus Audio atual.

## 1. Banco de dados (migration)

Novas tabelas (RLS por `auth.uid() = user_id`):

- `playlists` — `id, user_id, name, description, cover_url, is_public(bool, default false), tracks_count(int, default 0), duration_total(numeric, default 0), created_at, updated_at`
- `playlist_tracks` — `playlist_id, track_id, user_id, position(int), added_at`; PK `(playlist_id, track_id)`; index em `(playlist_id, position)`
- `upload_sessions` — `id, user_id, total_files, completed_files, failed_files, status('active'|'done'|'cancelled'), created_at, updated_at`
- `track_uploads` — `id, session_id, user_id, file_name, file_size, status('queued'|'uploading'|'done'|'error'|'skipped'), progress, track_id(nullable), error_message, created_at`
- Adicionar a `tracks`: `content_hash text` (sha-256 do arquivo, usado para detecção de duplicatas) + index único parcial `(user_id, content_hash) where content_hash is not null`.

Triggers:
- `set_updated_at` em `playlists` e `upload_sessions`.
- Trigger AFTER INSERT/DELETE em `playlist_tracks` que recalcula `tracks_count` e `duration_total` na `playlists` correspondente.

## 2. Server functions

`src/lib/playlists.functions.ts`:
- `listPlaylists`, `getPlaylist(id)` (retorna playlist + tracks ordenadas)
- `createPlaylist({ name, description?, trackIds? })`
- `updatePlaylist`, `deletePlaylist`
- `addTracksToPlaylist({ playlistId, trackIds, mode: 'append'|'prepend'|'afterCurrent', currentPosition? })`
- `removeTracksFromPlaylist({ playlistId, trackIds })`
- `reorderPlaylistTracks({ playlistId, orderedTrackIds })` — usa CTE para reescrever `position` atomicamente

`src/lib/library.functions.ts` (estender):
- `bulkUpdateTracks({ ids, patch: { genre?, is_favorite?, tags?[] } })` (limite 500)
- `bulkDeleteTracks` (já existe `deleteTracks`, aumentar limite + aceitar até 500)
- `findDuplicatesByHash({ hashes })` → retorna mapeamento hash→trackId existente
- `createUploadSession`, `updateUploadSession`, `recordTrackUpload` (granular para retomar/retry)

## 3. Upload em massa (cliente)

Refatorar `src/hooks/use-track-upload.ts` em `src/hooks/use-bulk-upload.ts`:
- Aceitar `File[]` ilimitado (UI valida count); fila interna com concorrência configurável (padrão 3, ajustável 1–6).
- Para cada arquivo:
  1. validar MIME/tamanho (mp3/flac/wav/m4a/aac, ≤50MB) e sanitizar nome
  2. calcular sha-256 via `crypto.subtle.digest` em chunks (Web Worker para arquivos >10MB)
  3. consultar `findDuplicatesByHash` em batch (lotes de 50); aplicar política escolhida (`skip` | `replace` | `keep_both`)
  4. parsear metadados (`music-metadata-browser`) + cover
  5. upload do áudio para bucket `tracks` (`{user_id}/{trackId}.{ext}`), cover para `covers`
  6. INSERT em `tracks` (com `content_hash`)
  7. atualizar `track_uploads.status='done'` + `upload_sessions.completed_files`
- Controles: `pause()`, `resume()`, `cancel(itemId)`, `cancelAll()`, `retry(itemId)` (backoff exponencial: 1s, 3s, 9s, máx 3 tentativas).
- Persistir progresso em `upload_sessions` para sobreviver a navegação (não a reload total).

Atualizar `src/stores/upload-store.ts`:
- Adicionar `sessionId`, `concurrency`, `isPaused`, `duplicatePolicy`, `speedBps`, `etaSec`
- Computar throughput (bytes/segundo) com janela móvel de 5s

`<UploadDropzone>` (estender):
- Aceitar `webkitdirectory` para drop/seleção de pastas inteiras (mapear estrutura → tags `folder:<nome>` automaticamente)
- Mostrar contagem antes do upload + modal de "duplicatas detectadas" com 3 opções

`<UploadQueuePanel>` (novo, fixo no canto inferior direito):
- Lista virtualizada com progresso individual, status, retry inline
- Header com progresso total, velocidade, ETA, botões pause/cancel/clear
- Minimizável; permanece montado em todas as rotas autenticadas (mover para `_authenticated.tsx`)

## 4. Seleção múltipla + ações em lote

`src/stores/selection-store.ts` (novo): `Set<string>` de IDs + `lastSelectedId` para shift-click.

Atualizar `<TrackTable>`:
- Checkbox por linha (visível no hover/quando há seleção)
- Header com checkbox "select all"
- Click: seleção única / `cmd/ctrl+click`: toggle / `shift+click`: range
- `Esc` limpa seleção

`<BulkSelectionToolbar>` (novo, aparece fixo no topo quando `selection.size > 0`):
- Contador, botões: Tocar agora, Adicionar à fila, Favoritar, Adicionar à playlist (popover), Mover para pasta, Editar tags/gênero (abre `<BulkEditModal>`), Baixar (gera signed URLs em batch), Deletar (confirmação)
- Atalhos: `Delete`, `F` (favoritar), `P` (playlist)

`<BulkEditModal>`: edita `genre`, adiciona/remove tags em N tracks via `bulkUpdateTracks`.

## 5. Playlists reais

Substituir mock em `playlists.$playlistId.tsx` por dados reais (loader + `useQuery`).

Atualizar `playlists.index.tsx`: grid de playlists do usuário + botão "Nova playlist".

`<PlaylistDropZone>`: zona drop em cada card e na sidebar (link de playlist) — aceita IDs de tracks via `dataTransfer`. Drag visual highlight + toast "+N adicionadas".

Drag-and-drop:
- `react-dnd` ou HTML5 DnD nativo (preferência: nativo, sem dep extra)
- Múltipla seleção arrastada conta como payload único `{ trackIds: [...] }`
- Reordenação dentro da playlist via `@dnd-kit/sortable` (já comum; adicionar se ausente)

Inserção: opções `append` (padrão), `prepend`, `afterCurrent` (usa `player-store.currentTrackId`).

Menu contextual (`<TrackContextMenu>` via Radix `ContextMenu`):
- Tocar agora, Adicionar à fila, Adicionar à playlist ▸ (lista + "Nova…"), Mover para pasta ▸, Favoritar, Editar, Deletar

## 6. Performance

- `@tanstack/react-virtual` (já instalado) em `TrackTable`, `UploadQueuePanel` e playlist tracks
- Hash sha-256 em Web Worker (`src/workers/hash.worker.ts`) para não bloquear UI
- `useQuery` com `staleTime` 30s para listagens; invalidação cirúrgica após mutations
- Debounce de busca 250ms; `useDeferredValue` em filtros

## 7. Componentes novos

```
src/components/library/
  bulk-selection-toolbar.tsx
  bulk-edit-modal.tsx
  upload-queue-panel.tsx
  track-context-menu.tsx
  duplicate-resolver-modal.tsx
src/components/playlists/
  playlist-card.tsx
  playlist-drop-zone.tsx
  create-playlist-dialog.tsx
  add-to-playlist-popover.tsx
src/stores/selection-store.ts
src/hooks/use-bulk-upload.ts
src/hooks/use-drag-tracks.ts
src/workers/hash.worker.ts
src/lib/playlists.functions.ts
```

## 8. Segurança

- Validação dupla MIME (cliente + server-side via `mime_type` salvo)
- Limite 50MB/arquivo, 500 arquivos/sessão, 5 sessões ativas/usuário
- Rate limit em `recordTrackUpload` (server-side: máx 100 inserts/min por user via tabela `rate_limits` simples ou checagem `count(*) where created_at > now() - interval '1 minute'`)
- Sanitização de nomes (`/[^a-zA-Z0-9._-]/g`)
- Nomes de arquivo no storage = `crypto.randomUUID()`, nunca nome original

## 9. Fora do escopo

- Compartilhamento social, colaboração realtime, comentários, feed
- Conversão de formato server-side (sem ffmpeg)
- Sync entre dispositivos em tempo real (mantém apenas player-store local)

## Dependências a adicionar

- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (drag & drop acessível)
- Nenhum hash externo — `crypto.subtle` nativo

## Ordem de implementação

1. Migration (tabelas + triggers + `content_hash`)
2. Server functions de playlists + bulk
3. `selection-store` + checkboxes + `BulkSelectionToolbar`
4. `use-bulk-upload` + worker de hash + `UploadQueuePanel` global + duplicate resolver
5. Playlists reais (CRUD UI) + `add-to-playlist-popover`
6. Drag & drop (multi-select → playlist) + reordenação
7. Context menu + `BulkEditModal`
8. Polimento: animações, atalhos, virtualização

Tudo dentro da estética Focus Audio atual (lime accent, Hanken Grotesk, surfaces escuras, animações sutis).
