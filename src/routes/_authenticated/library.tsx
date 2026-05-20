import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({ meta: [{ title: "Focus Audio — Library" }] }),
  component: () => <Outlet />,
});
