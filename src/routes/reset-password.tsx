import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthCard, Field } from "@/components/auth/auth-card";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada.");
    navigate({ to: "/dashboard" });
  };

  return (
    <AuthCard title="Definir nova senha" subtitle="Escolha uma senha forte para sua conta.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Nova senha"
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
          Atualizar senha
        </button>
      </form>
    </AuthCard>
  );
}
