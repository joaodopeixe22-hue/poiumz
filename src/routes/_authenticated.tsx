import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import { GlobalPlayerBar } from "@/components/player/GlobalPlayerBar";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
  },
  component: () => (
    <AudioPlayerProvider>
      <DashboardShell>
        <div className="flex flex-col min-h-full">
          <div className="flex-1">
            <Outlet />
          </div>
          <GlobalPlayerBar />
        </div>
      </DashboardShell>
    </AudioPlayerProvider>
  ),
});
