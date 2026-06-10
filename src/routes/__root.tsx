import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { installRealtimeDebug } from "@/lib/realtime-debug";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-mono-caption text-muted-foreground">404 // Não encontrado</p>
        <h1 className="font-display text-5xl mt-4">Perdido na estática.</h1>

        <p className="mt-3 text-sm text-muted-foreground">
          Esta página não existe ou se perdeu no dial.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-sm border border-accent px-5 py-2 text-xs font-mono uppercase tracking-widest text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-mono-caption text-muted-foreground">Erro</p>
        <h1 className="font-display text-4xl mt-3">Algo deu errado.</h1>

        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-sm border border-accent px-5 py-2 text-xs font-mono uppercase tracking-widest text-accent hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Aethel — Music, considered." },
      {
        name: "description",
        content:
          "Aethel is a premium music & radio streaming platform with multi-device sync, smart queues, and atmospheric audio.",
      },
      { name: "author", content: "Aethel" },
      { name: "theme-color", content: "#1c1a17" },
      { property: "og:title", content: "Aethel — Music, considered." },
      {
        property: "og:description",
        content: "Aura Stream is a modern, multi-device music and online radio streaming platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Aethel — Music, considered." },
      {
        name: "description",
        content: "Aura Stream is a modern, multi-device music and online radio streaming platform.",
      },
      {
        name: "twitter:description",
        content: "Aura Stream is a modern, multi-device music and online radio streaming platform.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/37f047de-a41e-4d4a-949b-8dea105e0d02/id-preview-9b7cac7f--2f72403f-8763-45b7-8b3a-1f09c5133b55.lovable.app-1779318466913.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/37f047de-a41e-4d4a-949b-8dea105e0d02/id-preview-9b7cac7f--2f72403f-8763-45b7-8b3a-1f09c5133b55.lovable.app-1779318466913.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthSync() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
