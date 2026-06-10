
-- RESET
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.playlist_tracks cascade;
drop table if exists public.track_folders cascade;
drop table if exists public.track_tags cascade;
drop table if exists public.track_uploads cascade;
drop table if exists public.upload_sessions cascade;
drop table if exists public.folders cascade;
drop table if exists public.tracks cascade;
drop table if exists public.playlists cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.profiles cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.has_role(uuid, public.app_role) cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.recompute_playlist_aggregates(uuid) cascade;
drop function if exists public.playlist_tracks_after_change() cascade;

drop type if exists public.app_role cascade;
drop type if exists public.user_role cascade;
drop type if exists public.user_status cascade;

-- ENUMS
create type public.user_role   as enum ('admin', 'operador');
create type public.user_status as enum ('pendente', 'aprovado', 'recusado');

-- TABELAS
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text,
  role        public.user_role   not null default 'operador',
  status      public.user_status not null default 'pendente',
  can_upload  boolean            not null default false,
  created_at  timestamptz        not null default now()
);

create table public.songs (
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null,
  artista          text,
  duracao_segundos integer,
  storage_path     text not null,
  uploaded_by      uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create table public.playlists (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.playlist_songs (
  id          uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id     uuid not null references public.songs(id)     on delete cascade,
  posicao     integer not null default 0,
  unique (playlist_id, song_id)
);

create table public.queue (
  id         uuid primary key default gen_random_uuid(),
  song_id    uuid not null references public.songs(id) on delete cascade,
  posicao    integer not null default 0,
  added_by   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.playback_state (
  id                  boolean primary key default true,
  is_playing          boolean not null default false,
  is_locked           boolean not null default false,
  current_song_id     uuid references public.songs(id)     on delete set null,
  current_playlist_id uuid references public.playlists(id) on delete set null,
  position_seconds    numeric not null default 0,
  volume              numeric not null default 0.8,
  controlled_by       uuid references public.profiles(id)  on delete set null,
  updated_at          timestamptz not null default now(),
  constraint single_row check (id = true)
);

insert into public.playback_state (id) values (true);

create index on public.playlist_songs (playlist_id, posicao);
create index on public.queue (posicao, created_at);
create index on public.songs (created_at desc);

-- GRANTS
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select on public.songs to anon, authenticated;
grant insert, update, delete on public.songs to authenticated;
grant all on public.songs to service_role;

grant select on public.playlists to anon, authenticated;
grant insert, update, delete on public.playlists to authenticated;
grant all on public.playlists to service_role;

grant select on public.playlist_songs to anon, authenticated;
grant insert, update, delete on public.playlist_songs to authenticated;
grant all on public.playlist_songs to service_role;

grant select on public.queue to anon, authenticated;
grant insert, update, delete on public.queue to authenticated;
grant all on public.queue to service_role;

grant select on public.playback_state to anon, authenticated;
grant update on public.playback_state to authenticated;
grant all on public.playback_state to service_role;

-- FUNÇÕES
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'aprovado');
$$;

create or replace function public.is_approved_member()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'aprovado' and role in ('admin','operador'));
$$;

create or replace function public.can_user_upload()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'aprovado'
      and (role = 'admin' or (role = 'operador' and can_upload = true))
  );
$$;

-- TRIGGER signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, role, status, can_upload)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), 'operador', 'pendente', false);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- TRIGGER modo deus
create or replace function public.enforce_playback_rules()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.is_locked is distinct from old.is_locked) and not public.is_admin() then
    raise exception 'Apenas o admin pode ativar/desativar o modo deus (trava).';
  end if;
  if old.is_locked = true and not public.is_admin() then
    raise exception 'A rádio está travada pelo admin (modo deus).';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_enforce_playback
  before update on public.playback_state
  for each row execute function public.enforce_playback_rules();

-- RLS
alter table public.profiles       enable row level security;
alter table public.songs          enable row level security;
alter table public.playlists      enable row level security;
alter table public.playlist_songs enable row level security;
alter table public.queue          enable row level security;
alter table public.playback_state enable row level security;

create policy "perfil: leitura propria ou admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "perfil: admin atualiza" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

create policy "songs: leitura publica" on public.songs for select using (true);
create policy "songs: insere quem pode upload" on public.songs
  for insert with check (public.can_user_upload());
create policy "songs: admin atualiza" on public.songs
  for update using (public.is_admin()) with check (public.is_admin());
create policy "songs: admin remove" on public.songs
  for delete using (public.is_admin());

create policy "playlists: leitura publica" on public.playlists for select using (true);
create policy "playlists: membro escreve" on public.playlists
  for insert with check (public.is_approved_member());
create policy "playlists: membro atualiza" on public.playlists
  for update using (public.is_approved_member()) with check (public.is_approved_member());
create policy "playlists: membro remove" on public.playlists
  for delete using (public.is_approved_member());

create policy "playlist_songs: leitura publica" on public.playlist_songs for select using (true);
create policy "playlist_songs: membro escreve" on public.playlist_songs
  for insert with check (public.is_approved_member());
create policy "playlist_songs: membro atualiza" on public.playlist_songs
  for update using (public.is_approved_member()) with check (public.is_approved_member());
create policy "playlist_songs: membro remove" on public.playlist_songs
  for delete using (public.is_approved_member());

create policy "queue: leitura publica" on public.queue for select using (true);
create policy "queue: membro adiciona" on public.queue
  for insert with check (public.is_approved_member());
create policy "queue: membro reordena" on public.queue
  for update using (public.is_approved_member()) with check (public.is_approved_member());
create policy "queue: membro remove" on public.queue
  for delete using (public.is_approved_member());

create policy "playback: leitura publica" on public.playback_state for select using (true);
create policy "playback: membro controla" on public.playback_state
  for update using (public.is_approved_member()) with check (public.is_approved_member());

-- REALTIME
alter publication supabase_realtime add table public.playback_state;
alter publication supabase_realtime add table public.queue;
