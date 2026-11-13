-- Som remoto: o operador ajusta pelo celular o volume e o perfil de som da rádio.
-- playback_state.volume já existe (0 a 1); aqui ele ganha limites e a rádio
-- ganha o perfil de ambiente compartilhado entre os aparelhos.

ALTER TABLE public.playback_state
  ADD COLUMN IF NOT EXISTS sound_profile text NOT NULL DEFAULT 'padrao';

ALTER TABLE public.playback_state
  DROP CONSTRAINT IF EXISTS playback_state_sound_profile_len;
ALTER TABLE public.playback_state
  ADD CONSTRAINT playback_state_sound_profile_len
  CHECK (char_length(sound_profile) BETWEEN 1 AND 40);

ALTER TABLE public.playback_state
  DROP CONSTRAINT IF EXISTS playback_state_volume_range;
ALTER TABLE public.playback_state
  ADD CONSTRAINT playback_state_volume_range
  CHECK (volume >= 0 AND volume <= 1);