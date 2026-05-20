
# Redesign visual — "Focus Audio / Premium Focus"

Substituir a direção atual **Editorial Charcoal** pela direção do mockup enviado: estética dark sofisticada, tipografia **Hanken Grotesk**, ícones **Material Symbols Outlined**, layout mais "app de áudio premium" (estilo Plexamp/Spotify refinado), com hero card grande, grid "Made for You", player global mais rico e página de playlist com tabela de tracks.

Mantém-se toda a lógica de Etapa 1 (auth, rotas, store do player, RLS). Apenas camada visual/presentation.

---

## 1. Design tokens (`src/styles.css`)

- Trocar fontes:
  - `--font-sans: "Hanken Grotesk"` (substitui Inter)
  - remover `--font-display` Playfair italic → títulos agora usam Hanken Grotesk 600
  - manter `--font-mono` para captions sutis
- Paleta dark "premium focus":
  - `--background` ~ `oklch(0.14 0.005 260)` (quase preto azulado)
  - `--card` ~ `oklch(0.18 0.006 260)`
  - `--sidebar` ~ `oklch(0.12 0.005 260)`
  - `--accent` muda de ouro mute → **lima/verde elétrico** `oklch(0.85 0.18 130)` (cor de destaque do mock — play buttons e "Premium Focus")
  - `--muted-foreground` cinza neutro `oklch(0.65 0.01 260)`
  - `--border` `oklch(1 0 0 / 0.08)`
- Adicionar import do Google Fonts (Hanken Grotesk + Material Symbols Outlined) no `__root.tsx` `<head>`.
- Nova utility `.material-symbols` (font-family + font-variation-settings) para ícones em vez de Lucide nos pontos-chave (player, sidebar). Lucide pode ficar como fallback onde já está.
- Remover `bg-atmosphere` antigo / `font-display italic` — substituir por gradiente sutil mais frio.

## 2. AppShell / Sidebar (`src/components/layout/app-shell.tsx`)

- Header da sidebar: logo "Focus Audio" + tag "Premium Focus" em accent lima.
- Itens de nav usando Material Symbols (`home`, `search`, `library_music`, `featured_play_list`, `settings`) com label ao lado.
- Topbar nova acima do conteúdo: search bar centralizada + ícones `notifications` e `account_circle` à direita.
- Player global redesenhado:
  - capa quadrada à esquerda + título/artista
  - controles centrais: `shuffle`, `skip_previous`, **play/pause grande circular accent lima**, `skip_next`, `repeat`
  - barra de progresso com timestamps (`12:34` / `-1:47:26`)
  - à direita: `favorite`, `mic`, `queue_music`, `devices`, `volume_up` + slider
  - fundo `bg-card/95 backdrop-blur` com borda superior accent sutil

## 3. Home (`src/routes/_authenticated/index.tsx`)

- Saudação "Good evening" grande (Hanken 600, sem itálico).
- Subtítulo "Your personalized audio space."
- **Hero card** full-width: badge "Deep Focus", título "Binaural Beats & Alpha Waves", descrição, botão play accent circular grande, imagem/gradiente à direita.
- Linha de 3 cards horizontais (Structural Silence / Night Drive / etc.) com cover + label.
- Seção "Made for You" com header + "View All", grid 4 colunas de cards com cover quadrado, hover revela botão play accent, título + descrição curta.

## 4. Nova rota: Playlist detail (`src/routes/_authenticated/playlists.$playlistId.tsx`)

Página de exemplo seguindo o segundo mock:
- Header: badge "Public Playlist", título grande "Deep Focus State", descrição, metadados ("Focus Audio Curators • 42 Tracks • 3 hr 45 min").
- Ações: play grande accent + `favorite_border` + `more_horiz`.
- **Tabela de tracks**: colunas `#`, `Title` (com cover mini + artista), `Album`, `schedule` (duração). Hover na linha → play icon substitui o número.
- Dados mockados estáticos (sem backend ainda — Etapa de playlists virá depois).
- Atualizar `playlists.tsx` (index) para listar playlists mockadas que linkam para `/playlists/$playlistId`.

## 5. Login / Signup / Forgot / Reset

- Atualizar `auth-shell.tsx` para refletir nova paleta + Hanken Grotesk, sem Playfair italic.
- Logo "Focus Audio" + tag "Premium Focus" lima no topo.

## 6. Demais rotas (Explore, Radios, Library, Downloads, Settings)

- Atualizar `page-shell.tsx` (`PageHeader` / `ComingSoon`) para nova tipografia (sem itálico serifado).
- Cores e espaçamentos se ajustam automaticamente via tokens.

---

## Arquivos tocados

```text
src/styles.css                                    # tokens, fontes, accent lima
src/routes/__root.tsx                             # <link> Google Fonts + Material Symbols
src/components/layout/app-shell.tsx               # sidebar, topbar, player redesign
src/components/layout/page-shell.tsx              # tipografia sem italic
src/components/auth/auth-shell.tsx                # marca + tipografia
src/routes/_authenticated/index.tsx               # nova home (hero + Made for You)
src/routes/_authenticated/playlists.tsx           # grid de playlists mock
src/routes/_authenticated/playlists.$playlistId.tsx  # NOVA — detalhe com tabela
```

## Fora de escopo

- Sem mudanças em backend, auth, RLS, store do player ou migrations.
- Dados de tracks/playlists permanecem mockados — Etapa 4 trará persistência real.
