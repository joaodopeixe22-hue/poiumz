import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { REFRESH_BEFORE_MS, isRejectedLogin, needsRefresh } from "./session-keeper";

describe("guardião do login", () => {
  const issued = Date.parse("2026-11-13T21:46:48Z"); // login real da loja
  const expiresAt = issued / 1000 + 3600;

  it("não renova enquanto falta mais que a margem", () => {
    expect(needsRefresh(expiresAt, issued)).toBe(false);
    expect(needsRefresh(expiresAt, issued + 54 * 60 * 1000)).toBe(false);
  });

  it("renova 5 minutos antes de vencer e depois de vencido", () => {
    expect(needsRefresh(expiresAt, issued + 3600_000 - REFRESH_BEFORE_MS)).toBe(true);
    expect(needsRefresh(expiresAt, issued + 3600_000 + 1)).toBe(true);
  });

  it("um relógio 1 hora atrasado esconderia o vencimento; a hora do servidor não", () => {
    const realNow = issued + 61 * 60 * 1000; // 1 min depois de vencer
    const skewedLocalNow = realNow - 3_660_000; // o que o PC da loja enxergava
    expect(needsRefresh(expiresAt, skewedLocalNow)).toBe(false);
    expect(needsRefresh(expiresAt, realNow)).toBe(true);
  });

  it("ignora sessões sem validade conhecida", () => {
    expect(needsRefresh(undefined, issued)).toBe(false);
    expect(needsRefresh(null, issued)).toBe(false);
    expect(needsRefresh(0, issued)).toBe(false);
    expect(needsRefresh(NaN, issued)).toBe(false);
  });

  it("reconhece a recusa do servidor", () => {
    expect(isRejectedLogin({ status: 401 })).toBe(true);
    expect(isRejectedLogin({ status: 403 })).toBe(true);
    expect(isRejectedLogin({ status: 500 })).toBe(false);
    expect(isRejectedLogin({})).toBe(false);
    expect(isRejectedLogin(null)).toBe(false);
  });
});
