import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bem-vindo de volta.");
    navigate({ to: "/" });
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      toast.error("Falha ao entrar com Google.");
      return;
    }
    if (result.redirected) return;
    setGoogleLoading(false);
    navigate({ to: "/" });
  };

  return (
    <AuthShell
      eyebrow="Entrar"
      title="Bem-vindo de volta."
      subtitle="Continue de onde parou — sua fila, sua biblioteca, seus dispositivos."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Field
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          required
        />
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Esqueceu a senha?
          </Link>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-sm bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          Entrar
        </button>
      </form>

      <div className="my-7 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono-caption text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <button
        onClick={handleGoogle}
        disabled={googleLoading}
        className="w-full h-11 rounded-sm border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
      >
        {googleLoading ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
        Continuar com o Google
      </button>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Novo por aqui?{" "}
        <Link to="/signup" className="text-accent hover:underline">
          Criar uma conta
        </Link>
      </p>
    </AuthShell>
  );
}

function Field(props: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="font-mono-caption text-muted-foreground">{props.label}</span>
      <input
        type={props.type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        required={props.required}
        className="w-full h-11 px-3 rounded-sm bg-input/40 border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-accent/40 transition-colors"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.95h5.51c-.24 1.42-1.7 4.16-5.51 4.16-3.32 0-6.03-2.75-6.03-6.13S8.68 5.95 12 5.95c1.89 0 3.16.81 3.88 1.5l2.65-2.55C16.94 3.36 14.68 2.4 12 2.4 6.86 2.4 2.7 6.56 2.7 11.7s4.16 9.3 9.3 9.3c5.37 0 8.93-3.77 8.93-9.08 0-.61-.07-1.07-.16-1.53H12z"
      />
    </svg>
  );
}
