import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Megaphone,
  Plus,
  Search,
  Trash2,
  Play,
  Pause,
  Power,
  PowerOff,
  Clock,
  Repeat,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProfile } from "@/hooks/use-profile";
import {
  useInstitutional,
  getInstitutionalPublicUrl,
  type InstitutionalContent,
} from "@/hooks/use-institutional";
import { usePlayback } from "@/hooks/use-playback";
import { supabase } from "@/integrations/supabase/client";
import { formatTime, formatRelative } from "@/lib/format";
import { InstitutionalUploadDialog } from "@/components/institucional/upload-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/institucional")({
  component: InstitucionalPage,
});

function InstitucionalPage() {
  const { profile } = useProfile();
  const { items, loading, refresh } = useInstitutional();
  const { playback, setInstitutionalEnabled } = usePlayback();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState<InstitutionalContent | null>(null);
  const [query, setQuery] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isAdmin = profile?.role === "admin";
  const moduleEnabled = playback?.institutional_enabled ?? true;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.titulo.toLowerCase().includes(q));
  }, [items, query]);

  const stats = useMemo(
    () => ({
      total: items.length,
      ativos: items.filter((i) => i.ativo).length,
      vinhetas: items.filter((i) => i.tipo === "vinheta").length,
      avisos: items.filter((i) => i.tipo === "aviso").length,
    }),
    [items],
  );

  const togglePlay = async (item: InstitutionalContent) => {
    if (playingId === item.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    try {
      const url = getInstitutionalPublicUrl(item.storage_path);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = url;
      audioRef.current.onended = () => setPlayingId(null);
      await audioRef.current.play();
      setPlayingId(item.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível reproduzir");
    }
  };

  const toggleAtivo = async (item: InstitutionalContent) => {
    const { error } = await supabase
      .from("institutional_contents")
      .update({ ativo: !item.ativo })
      .eq("id", item.id);
    if (error) toast.error(error.message);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    await supabase.storage.from("institutional").remove([target.storage_path]);
    const { error } = await supabase
      .from("institutional_contents")
      .delete()
      .eq("id", target.id);
    if (error) return toast.error(error.message);
    toast.success("Conteúdo removido.");
    refresh();
  };

  const handleModuleToggle = async (next: boolean) => {
    const { error } = await setInstitutionalEnabled(next);
    if (error) toast.error(error);
    else toast.success(next ? "Módulo ativado." : "Módulo desativado.");
  };

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Programação
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Conteúdos institucionais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vinhetas e avisos com agendamento automático entre as músicas.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setUploadOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Novo conteúdo
          </Button>
        )}
      </div>

      {/* Módulo on/off (admin) */}
      <div
        className={`rounded-2xl border p-5 flex items-center justify-between gap-4 ${
          moduleEnabled
            ? "border-primary/30 bg-primary/5"
            : "border-yellow-500/30 bg-yellow-500/5"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`size-10 rounded-xl grid place-items-center shrink-0 ${
              moduleEnabled
                ? "bg-primary/15 text-primary"
                : "bg-yellow-500/15 text-yellow-600"
            }`}
          >
            {moduleEnabled ? <Power className="size-5" /> : <PowerOff className="size-5" />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold">
              {moduleEnabled
                ? "Módulo institucional ativo"
                : "Módulo institucional desligado"}
            </p>
            <p className="text-xs text-muted-foreground">
              {moduleEnabled
                ? "Vinhetas e avisos serão inseridos automaticamente conforme o agendamento."
                : "Nenhuma vinheta ou aviso será tocada, mesmo que esteja agendada."}
            </p>
          </div>
        </div>
        {isAdmin ? (
          <Switch checked={moduleEnabled} onCheckedChange={handleModuleToggle} />
        ) : (
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            apenas admin
          </span>
        )}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={Megaphone} label="Total" value={stats.total} />
        <Stat icon={Volume2} label="Ativos" value={stats.ativos} tone="primary" />
        <Stat icon={Repeat} label="Vinhetas" value={stats.vinhetas} />
        <Stat icon={Clock} label="Avisos" value={stats.avisos} />
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por título…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Megaphone className="size-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">
              {query ? "Nenhum resultado." : "Nenhum conteúdo cadastrado."}
            </p>
            {!query && isAdmin && (
              <p className="text-xs text-muted-foreground mt-1">
                Clique em "Novo conteúdo" para começar.
              </p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left py-3 px-4 w-12"></th>
                <th className="text-left py-3 px-4">Título</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">Tipo</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">Agendamento</th>
                <th className="text-left py-3 px-4 hidden lg:table-cell">Duração</th>
                <th className="text-left py-3 px-4 hidden lg:table-cell">Enviado</th>
                <th className="text-right py-3 px-4 w-32">Ativo</th>
                {isAdmin && <th className="text-right py-3 px-4 w-16">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr
                  key={it.id}
                  className={`border-t border-border transition-colors ${
                    it.ativo ? "hover:bg-secondary/30" : "opacity-60 hover:bg-secondary/20"
                  }`}
                >
                  <td className="py-3 px-4">
                    <button
                      onClick={() => togglePlay(it)}
                      className="size-8 rounded-full grid place-items-center bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors"
                      aria-label={playingId === it.id ? "Pausar" : "Reproduzir"}
                    >
                      {playingId === it.id ? (
                        <Pause className="size-3.5" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                    </button>
                  </td>
                  <td className="py-3 px-4 font-medium truncate max-w-xs">{it.titulo}</td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                        it.tipo === "vinheta"
                          ? "bg-primary/10 text-primary"
                          : "bg-yellow-500/10 text-yellow-600"
                      }`}
                    >
                      {it.tipo === "vinheta" ? "Vinheta" : "Aviso"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground hidden md:table-cell">
                    <div className="flex flex-col gap-0.5">
                      {it.frequencia_musicas && (
                        <span className="inline-flex items-center gap-1">
                          <Repeat className="size-3" /> a cada {it.frequencia_musicas}{" "}
                          {it.frequencia_musicas === 1 ? "música" : "músicas"}
                        </span>
                      )}
                      {it.horario && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" /> {it.horario.slice(0, 5)}
                        </span>
                      )}
                      {!it.frequencia_musicas && !it.horario && (
                        <span className="text-muted-foreground/70">—</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">
                    {formatTime(it.duracao_segundos)}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">
                    {formatRelative(it.created_at)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Switch
                      checked={it.ativo}
                      onCheckedChange={() => toggleAtivo(it)}
                      disabled={!isAdmin}
                    />
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setDeleting(it)}
                        className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        aria-label="Excluir"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <InstitutionalUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onComplete={refresh}
      />
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conteúdo?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.titulo}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Megaphone;
  label: string;
  value: number;
  tone?: "primary";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Icon
          className={`size-4 ${tone === "primary" ? "text-primary" : "text-muted-foreground"}`}
        />
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mt-2">{label}</p>
      <p className="text-2xl font-bold mt-0.5">{value}</p>
    </div>
  );
}
