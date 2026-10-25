# Architecture rules
- Keep the public radio synchronized through playback_state and existing guarded RPCs; automatic advancement requires an approved operator/admin session and never grants anonymous control.
- Keep public radio audio separate from the authenticated shared player; the latter owns two bound audio elements for music-only Smart Mix and reuses the prepared inactive element for transitions.
- Keep playback continuity decisions in browser-safe pure helpers with regression tests, and read current callback refs from lifetime audio listeners to avoid stale queue/settings closures.
- Each content route owns its head metadata via the shared pageHead helper so titles and social descriptions remain unique and consistently branded.