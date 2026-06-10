import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthCard, Field } from "@/components/auth/auth-card";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
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
    toast.success("E-mail de recuperação enviado.");
  };

  return (
    <AuthCard
      title="Recuperar senha"
      subtitle={
        sent
          ? "Confira sua caixa de entrada e siga o link para definir uma nova senha."
          : "Enviaremos um link de redefinição para o seu e-mail."
      }
      footer={
        <Link to="/login" className="text-primary hover:underline font-medium">
          Voltar para login
        </Link>
      }
    >
      {!sent && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="E-mail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Enviar link
          </button>
        </form>
      )}
    </AuthCard>
  );
}
