# Aura Stream

PLATAFORMA AVANÇADA DE STREAMING MUSICAL MULTI-DISPOSITIVO

OBJETIVO PRINCIPAL

Criar uma plataforma moderna de música e rádio online inspirada em Spotify, Deezer e Plexamp, focada em:
- experiência premium de áudio;
- sincronização entre dispositivos;
- automação inteligente;
- organização avançada da biblioteca;
- reprodução contínua;
- alta performance;
- controle total do usuário.

A plataforma deve permitir:
- streaming de rádios online;
- reprodução de MP3 próprios;
- integração com embeds externos;
- playlists públicas;
- sincronização multi-device em tempo real;
- sistema inteligente de fila e automação musical.

A interface deve ser extremamente moderna, fluida, minimalista e elegante, baseada nas melhores práticas premiadas de UX/UI dos últimos anos.

STACK PRINCIPAL

Frontend:
- React
- TypeScript
- Tailwind CSS
- Zustand (estado global)
- Framer Motion
- React Query/TanStack Query

Backend:
- Supabase
  - Auth
  - Database
  - Realtime
  - Storage
  - Edge Functions

Processamento:
- yt-dlp
- ffmpeg

PWA:
- vite-plugin-pwa

Áudio:
- HTML5 Audio API
- Web Audio API

==================================================================
ETAPA 1 - AUTENTICAÇÃO E ESTRUTURA GLOBAL
==================================================================

Implementar:

1. Sistema de autenticação:
- Login
- Cadastro
- Recuperação de senha
- Persistência de sessão

2. Estrutura base:
- Sidebar responsiva
- Player global fixo
- Navegação principal

3. Navegação:
- Home
- Explorar
- Rádios
- Playlists
- Biblioteca
- Downloads
- Configurações

4. Estado global:
- currentTrack
- queue
- currentDevice
- playbackState
- volume
- equalizer

5. Tema:
- Dark mode premium

NÃO implementar:
- Feed social
- Comentários
- Chat

==================================================================
ETAPA 2 - PLAYER PROFISSIONAL
==================================================================

Implementar:

1. Player completo:
- Play/Pause
- Seek
- Volume
- Próxima
- Anterior
- Repeat
- Shuffle

2. Queue avançada:
- Tocar a seguir
- Reordenação
- Persistência

3. Smart Queue:
- Prioridade manual
- Continuação automática inteligente

4. Crossfade:
- 2s
- 5s
- 10s

5. Replay inteligente:
- Continuar exatamente de onde parou

6. Histórico:
- últimas músicas reproduzidas

7. Mini Player:
- flutuante
- minimizável

8. Atalhos de teclado

==================================================================
ETAPA 3 - STREAMING E RÁDIOS ONLINE
==================================================================

Implementar:

1. Diretório de rádios:
- API pública
- filtros
- gêneros
- países

2. Rádio infinita:
- continuar automaticamente rádios similares

3. Auto-DJ:
- selecionar próximas músicas baseado em:
  - gênero
  - energia
  - tags

4. Continuação inteligente:
- manter vibe atual automaticamente

5. Streaming otimizado:
- pré-buffer
- troca instantânea
- fallback automático

==================================================================
ETAPA 4 - PLAYLISTS AVANÇADAS
==================================================================

Implementar:

1. Playlists públicas:
- qualquer pessoa pode ouvir

2. Usuários autenticados:
- criar
- editar
- excluir playlists próprias

3. Pastas de playlists:
- organização avançada

4. Tags personalizadas:
- estudo
- treino
- relaxamento
- foco

5. Biblioteca inteligente:
- filtros avançados
- busca dinâmica

6. Reprodução:
- iniciar de qualquer música
- shuffle inteligente sem repetição

7. Estatísticas:
- plays
- músicas populares
- tempo ouvido

==================================================================
ETAPA 5 - MULTI-DISPOSITIVO
==================================================================

Implementar:

1. Sincronização em tempo real:
- play
- pause
- seek
- troca de faixa
- queue

2. Escolha de dispositivo ativo:
- desktop
- celular
- tablet

3. Spotify Connect-like:
- controlar outro dispositivo remotamente

4. Transferência instantânea:
- mover reprodução entre dispositivos

5. Estado sincronizado:
- todos dispositivos seguem mesma reprodução

6. Device manager:
- listar dispositivos ativos

==================================================================
ETAPA 6 - QUALIDADE DE ÁUDIO
==================================================================

Implementar:

1. Equalizador:
- graves
- médios
- agudos

2. Bass boost

3. Perfis de som:
- Bass Boost
- Vocal
- Focus
- Cinema
- Flat

4. Normalização de volume

5. Web Audio API:
- processamento avançado

6. Configurações persistentes

==================================================================
ETAPA 7 - DOWNLOAD E PROCESSAMENTO
==================================================================

Implementar:

1. Download YouTube:
- yt-dlp
- ffmpeg

2. Conversão:
- MP3

3. Upload automático:
- Supabase Storage

4. Biblioteca automática

5. Segurança:
- sanitização
- rate limit
- timeout

==================================================================
ETAPA 8 - EMBEDS EXTERNOS
==================================================================

Implementar:

1. Aba SoundCloud
2. Aba Spotify
3. Aba YouTube

Com:
- iframes oficiais
- transições suaves
- renderização condicional

==================================================================
ETAPA 9 - PERFORMANCE
==================================================================

Implementar:

1. Cache inteligente:
- músicas recentes
- capas
- playlists

2. PWA:
- instalável
- offline parcial

3. Compressão adaptativa

4. Lazy loading

5. Virtualização de listas grandes

6. Streaming resiliente:
- reconexão automática

7. Pré-carregamento inteligente

==================================================================
ETAPA 10 - UX PREMIUM
==================================================================

Implementar:

1. Interface extremamente fluida
2. Micro animações premium
3. Skeleton loading
4. Feedback visual instantâneo
5. Transições suaves
6. Modo foco
7. Fullscreen player
8. Picture-in-picture YouTube

==================================================================
BANCO DE DADOS
==================================================================

Tabelas principais:

users
playlists
playlist_items
tracks
favorites
player_state
devices
radio_stations
play_events
track_stats
playlist_stats
queue_state

==================================================================
SEGURANÇA
==================================================================

Implementar:
- RLS em todas tabelas
- validação de uploads
- proteção contra spam
- rate limit
- sanitização de inputs

==================================================================
UI/DESIGN
==================================================================

Visual:
- moderno
- premium
- minimalista
- inspirado em Spotify/Plexamp

Design:
- dark mode
- bordas suaves
- animações fluidas
- tipografia moderna
- responsividade total

A UI deve ser bonita, harmônica, intuitiva, moderna e baseada nas melhores práticas recomendadas com premiações de design e UX dos últimos anos.

==================================================================
NÃO IMPLEMENTAR
==================================================================

- Feed social complexo
- Comentários
- Chat
- Marketplace
- NFTs
- Sistema financeiro
- Monetização
- Compartilhamento social avançado

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://poiumz.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2f72403f-8763-45b7-8b3a-1f09c5133b55).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
