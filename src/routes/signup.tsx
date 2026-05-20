import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";

export const Route = createFileRoute("/signup")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: SignupPage,
});

const schema = z.object({
  displayName: z.string().trim().min(1, "Required").max(80),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});

function SignupPage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ displayName, email, password });
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
        data: { display_name: parsed.data.displayName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. Welcome to Aethel.");
    navigate({ to: "/" });
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-up failed.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <AuthShell
      eyebrow="Create account"
      title="Begin the rotation."
      subtitle="Free forever. Bring your library, your radios, your dispositivos."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Display name" value={displayName} onChange={setDisplayName} required />
        <Field label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} required />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-sm bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          Create account
        </button>
      </form>

      <div className="my-7 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono-caption text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <button
        onClick={handleGoogle}
        className="w-full h-11 rounded-sm border border-border text-sm font-medium hover:bg-secondary transition-colors flex items-center justify-center gap-3"
      >
        Continue with Google
      </button>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

function Field(props: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="font-mono-caption text-muted-foreground">{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        required={props.required}
        className="w-full h-11 px-3 rounded-sm bg-input/40 border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-accent/40 transition-colors"
      />
    </label>
  );
}
