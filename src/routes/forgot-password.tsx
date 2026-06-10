import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <AuthShell
      eyebrow="Recuperar acesso"
      title={sent ? "Confira sua caixa de entrada." : "Redefina sua senha."}
      subtitle={
        sent
          ? "Enviamos um link. Abra-o neste dispositivo para escolher uma nova senha."
          : "Informe seu email e enviaremos as instruções para escolher uma nova senha."
      }
    >
      {!sent && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block space-y-2">
            <span className="font-mono-caption text-muted-foreground">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-3 rounded-sm bg-input/40 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-sm bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Enviar link de redefinição
          </button>
        </form>
      )}
      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link to="/login" className="text-accent hover:underline">
          Voltar para entrar
        </Link>
      </p>
    </AuthShell>
  );
}
