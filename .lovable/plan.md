## Corrigir 2 erros de TypeScript

**1. `src/components/library/track-table.tsx:190`** — `toggleSelect` não existe. Já há `const toggle = useSelectionStore((s) => s.toggle)` no escopo e o JSX já usa `onChange={() => toggle(t.id)}`. O erro indica que ainda existe uma referência residual a `toggleSelect` na linha 190. Remover/substituir essa referência por `toggle(t.id)`.

**2. `src/routes/_authenticated/playlists.$playlistId.tsx:66`** — O retorno de `getPlaylist` traz `track` como `SelectQueryError` porque o Supabase não infere a relação `playlist_tracks → tracks` (sem FK declarada). Cast em dois passos via `unknown`:

```ts
if (data?.tracks) setOrder(data.tracks as unknown as PT[]);
```

Já está nesse formato, mas o TS ainda reclama porque o cast direto através de `unknown as PT[]` num array já tipado dispara o erro 2352 em modo estrito. Solução: tipar a variável intermediária:

```ts
if (data?.tracks) {
  const list = data.tracks as unknown;
  setOrder(list as PT[]);
}
```

Ou usar `JSON.parse(JSON.stringify(...))` — mas a abordagem com variável intermediária é mais limpa e zero-custo.

### Resumo dos arquivos
- `src/components/library/track-table.tsx` — remover referência órfã a `toggleSelect`
- `src/routes/_authenticated/playlists.$playlistId.tsx` — quebrar o cast em duas etapas
