CREATE TYPE public.institutional_type AS ENUM ('vinheta', 'aviso');

CREATE TABLE public.institutional_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.institutional_type NOT NULL,
  titulo text NOT NULL,
  storage_path text NOT NULL,
  duracao_segundos integer,
  ativo boolean NOT NULL DEFAULT true,
  frequencia_musicas integer,
  horario time,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT institutional_freq_positive CHECK (frequencia_musicas IS NULL OR frequencia_musicas > 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.institutional_contents TO authenticated;
GRANT ALL ON public.institutional_contents TO service_role;

ALTER TABLE public.institutional_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "institucional: leitura aprovados" ON public.institutional_contents
  FOR SELECT USING (public.is_approved_member());
CREATE POLICY "institucional: admin insere" ON public.institutional_contents
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "institucional: admin atualiza" ON public.institutional_contents
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "institucional: admin remove" ON public.institutional_contents
  FOR DELETE USING (public.is_admin());

ALTER TABLE public.playback_state
  ADD COLUMN IF NOT EXISTS institutional_enabled boolean NOT NULL DEFAULT true;

ALTER PUBLICATION supabase_realtime ADD TABLE public.institutional_contents;