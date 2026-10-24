import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthCard, Field } from "@/components/auth/auth-card";

export const Route = createFileRoute("/signup")({
  head: () => pageHead("Criar conta", "Solicite acesso à administração da Rádio RD Saúde."),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: SignupPage,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(80),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(72),
});

function SignupPage() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ nome, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nome: parsed.data.nome },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      "Cadastro enviado. Aguarde a aprovação do administrador para acessar o painel.",
    );
    navigate({ to: "/login" });
  };

  return (
    <AuthCard
      title="Criar conta"
      subtitle="Seu acesso ficará pendente até que um administrador aprove."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome completo" value={nome} onChange={setNome} required />
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Field
          label="Senha"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          required
          placeholder="Mínimo 8 caracteres"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          Criar conta
        </button>
      </form>
    </AuthCard>
  );
}
