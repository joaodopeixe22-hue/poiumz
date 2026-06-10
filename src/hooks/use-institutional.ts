import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type InstitutionalType = "vinheta" | "aviso";

export type InstitutionalContent = {
  id: string;
  tipo: InstitutionalType;
  titulo: string;
  storage_path: string;
  duracao_segundos: number | null;
  ativo: boolean;
  frequencia_musicas: number | null;
  horario: string | null; // "HH:MM:SS"
  created_by: string | null;
  created_at: string;
};

export function useInstitutional() {
  const [items, setItems] = useState<InstitutionalContent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("institutional_contents")
      .select(
        "id, tipo, titulo, storage_path, duracao_segundos, ativo, frequencia_musicas, horario, created_by, created_at",
      )
      .order("created_at", { ascending: false });
    if (!error && data) setItems(data as InstitutionalContent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("institutional-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "institutional_contents" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  return { items, loading, refresh };
}

export function getInstitutionalPublicUrl(path: string) {
  const { data } = supabase.storage.from("institutional").getPublicUrl(path);
  return data.publicUrl;
}
