
CREATE TABLE IF NOT EXISTS public.radio_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  nome text NOT NULL DEFAULT 'Rádio RD',
  slogan text,
  descricao text,
  cor_primaria text NOT NULL DEFAULT '#3b82f6',
  logo_url text,
  contato_email text,
  contato_whatsapp text,
  permitir_ouvinte_publico boolean NOT NULL DEFAULT true,
  default_volume integer NOT NULL DEFAULT 80 CHECK (default_volume BETWEEN 0 AND 100),
  fuso_horario text NOT NULL DEFAULT 'America/Sao_Paulo',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radio_settings TO authenticated;
GRANT SELECT ON public.radio_settings TO anon;
GRANT ALL ON public.radio_settings TO service_role;

ALTER TABLE public.radio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode ler configurações" ON public.radio_settings
  FOR SELECT USING (true);

CREATE POLICY "Apenas admin pode atualizar configurações" ON public.radio_settings
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Apenas admin pode inserir configurações" ON public.radio_settings
  FOR INSERT WITH CHECK (public.is_admin());

INSERT INTO public.radio_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.touch_radio_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_radio_settings ON public.radio_settings;
CREATE TRIGGER trg_touch_radio_settings BEFORE UPDATE ON public.radio_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_radio_settings();
