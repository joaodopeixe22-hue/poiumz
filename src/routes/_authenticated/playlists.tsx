import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/playlists")({
  head: () => ({ meta: [{ title: "Focus Audio — Playlists" }] }),
  component: () => <Outlet />,
});
