import { pageHead } from "@/lib/page-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Save, Settings as SettingsIcon, Radio, Mail, MessageCircle, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/hooks/use-profile";
import { useRadioSettings, type RadioSettings } from "@/hooks/use-radio-settings";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/configuracoes")({
  head: () => pageHead("Configurações", "Ajuste a identidade e as preferências da Rádio RD Saúde."),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useProfile();
  const { settings, loading, update } = useRadioSettings();
  const [form, setForm] = useState<RadioSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = profile?.role === "admin" && profile?.status === "aprovado";

  useEffect(() => {
    if (!profileLoading && profile && !isAdmin) {
      navigate({ to: "/dashboard" });
    }
  }, [profile, profileLoading, isAdmin, navigate]);

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  if (loading || !form) {
    return (
      <div className="p-6 md:p-10">
        <div className="h-8 w-48 bg-secondary animate-pulse rounded mb-4" />
        <div className="h-64 bg-secondary/40 animate-pulse rounded-2xl" />
      </div>
    );
  }

  const set = <K extends keyof RadioSettings>(k: K, v: RadioSettings[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    const { error } = await update({
      nome: form.nome.trim(),
      slogan: form.slogan?.trim() || null,
      descricao: form.descricao?.trim() || null,
      cor_primaria: form.cor_primaria,
      logo_url: form.logo_url?.trim() || null,
      contato_email: form.contato_email?.trim() || null,
      contato_whatsapp: form.contato_whatsapp?.trim() || null,
      permitir_ouvinte_publico: form.permitir_ouvinte_publico,
      default_volume: form.default_volume,
      fuso_horario: form.fuso_horario,
    });
    setSaving(false);
    if (error) toast.error(error);
    else toast.success("Configurações salvas.");
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-4xl">
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
          Administração
        </p>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="size-7" /> Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Identidade da rádio, contato e preferências globais. Aplicado para todos os usuários.
        </p>
      </div>

      {/* Identidade */}
      <Section icon={Radio} title="Identidade da rádio">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nome">
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} maxLength={80} />
          </Field>
          <Field label="Slogan">
            <Input
              value={form.slogan ?? ""}
              onChange={(e) => set("slogan", e.target.value)}
              maxLength={120}
              placeholder="Sua música, sua história"
            />
          </Field>
          <Field label="Cor primária">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.cor_primaria}
                onChange={(e) => set("cor_primaria", e.target.value)}
                className="size-10 rounded-md border border-border bg-transparent cursor-pointer"
              />
              <Input
                value={form.cor_primaria}
                onChange={(e) => set("cor_primaria", e.target.value)}
                maxLength={9}
              />
            </div>
          </Field>
          <Field label="Fuso horário">
            <Input
              value={form.fuso_horario}
              onChange={(e) => set("fuso_horario", e.target.value)}
              placeholder="America/Sao_Paulo"
            />
          </Field>
        </div>
        <Field label="Descrição">
          <Textarea
            value={form.descricao ?? ""}
            onChange={(e) => set("descricao", e.target.value)}
            rows={3}
            maxLength={400}
            placeholder="Conte aos ouvintes do que se trata a rádio."
          />
        </Field>
      </Section>

      {/* Visual */}
      <Section icon={ImageIcon} title="Logo">
        <Field label="URL da logo">
          <Input
            value={form.logo_url ?? ""}
            onChange={(e) => set("logo_url", e.target.value)}
            placeholder="https://..."
          />
        </Field>
        {form.logo_url && (
          <div className="mt-2 size-24 rounded-xl border border-border bg-secondary/40 overflow-hidden grid place-items-center">
            <img
              src={form.logo_url}
              alt="Logo"
              className="size-full object-contain"
              onError={(e) => ((e.currentTarget.style.display = "none"))}
            />
          </div>
        )}
      </Section>

      {/* Contato */}
      <Section icon={Mail} title="Contato">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="E-mail">
            <Input
              type="email"
              value={form.contato_email ?? ""}
              onChange={(e) => set("contato_email", e.target.value)}
              placeholder="contato@radio.com"
            />
          </Field>
          <Field label="WhatsApp">
            <div className="relative">
              <MessageCircle className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={form.contato_whatsapp ?? ""}
                onChange={(e) => set("contato_whatsapp", e.target.value)}
                placeholder="+55 11 99999-9999"
                className="pl-9"
              />
            </div>
          </Field>
        </div>
      </Section>

      {/* Preferências */}
      <Section icon={SettingsIcon} title="Preferências globais">
        <div className="rounded-xl border border-border p-4 flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">Permitir página pública de ouvinte</p>
            <p className="text-xs text-muted-foreground mt-1">
              Quando ligado, qualquer pessoa pode escutar pela URL pública sem login.
            </p>
          </div>
          <Switch
            checked={form.permitir_ouvinte_publico}
            onCheckedChange={(v) => set("permitir_ouvinte_publico", v)}
          />
        </div>

        <Field label={`Volume padrão (${form.default_volume}%)`}>
          <input
            type="range"
            min={0}
            max={100}
            value={form.default_volume}
            onChange={(e) => set("default_volume", Number(e.target.value))}
            className="w-full accent-primary"
          />
        </Field>
      </Section>

      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" onClick={handleSave} disabled={saving} className="gap-2 shadow-lg">
          <Save className="size-4" />
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Radio;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
