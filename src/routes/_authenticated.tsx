import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/app-shell";
import { AudioEngine } from "@/components/library/audio-engine";
import { UploadQueuePanel } from "@/components/library/upload-queue-panel";
import { BulkSelectionToolbar } from "@/components/library/bulk-selection-toolbar";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
      <AudioEngine />
      <BulkSelectionToolbar />
      <UploadQueuePanel />
    </AppShell>
  ),
});
