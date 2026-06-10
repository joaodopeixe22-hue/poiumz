import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RadioSettings = {
  id: boolean;
  nome: string;
  slogan: string | null;
  descricao: string | null;
  cor_primaria: string;
  logo_url: string | null;
  contato_email: string | null;
  contato_whatsapp: string | null;
  permitir_ouvinte_publico: boolean;
  default_volume: number;
  fuso_horario: string;
  updated_at: string;
  updated_by: string | null;
};

export function useRadioSettings() {
  const [settings, setSettings] = useState<RadioSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("radio_settings" as never)
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (data) setSettings(data as RadioSettings);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("radio-settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "radio_settings" },
        (payload) => {
          if (payload.new) setSettings(payload.new as RadioSettings);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  const update = async (patch: Partial<Omit<RadioSettings, "id" | "updated_at" | "updated_by">>) => {
    const { error } = await supabase
      .from("radio_settings" as never)
      .update(patch as never)
      .eq("id", true);
    return { error: error?.message ?? null };
  };

  return { settings, loading, refresh, update };
}
