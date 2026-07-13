import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "./useAuth";

const mockAuth = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
};

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: vi.fn(() => ({ auth: mockAuth })),
}));

const sinSesion = { data: { session: null } };
const conSesion = (email = "pau@grenoucerie.com") => ({
  data: { session: { access_token: "tok-123", user: { email } } },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.getSession.mockResolvedValue(sinSesion);
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
});

describe("useAuth — sin nube configurada", () => {
  it("no se queda cargando y no exige sesion (modo local)", async () => {
    const { result } = renderHook(() => useAuth({ url: "", key: "" }));
    // No debe intentar crear cliente ni quedarse en authLoading=true para siempre
    expect(result.current.authLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe("useAuth — con nube configurada", () => {
  const cloudConfig = { url: "https://test.supabase.co", key: "anon-key" };

  it("recupera la sesion existente al montar", async () => {
    mockAuth.getSession.mockResolvedValue(conSesion());
    const { result } = renderHook(() => useAuth(cloudConfig));

    await waitFor(() => expect(result.current.authLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.userEmail).toBe("pau@grenoucerie.com");
  });

  it("login exitoso actualiza la sesion", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: conSesion("anabel@grenoucerie.com").data.session ? { session: conSesion("anabel@grenoucerie.com").data.session } : {}, error: null });
    const { result } = renderHook(() => useAuth(cloudConfig));
    await waitFor(() => expect(result.current.authLoading).toBe(false));

    let ok;
    await act(async () => {
      ok = await result.current.login("anabel@grenoucerie.com", "secreto");
    });

    expect(ok).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.userEmail).toBe("anabel@grenoucerie.com");
  });

  it("login fallido deja authError con el mensaje de Supabase", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: null, error: { message: "Invalid login credentials" } });
    const { result } = renderHook(() => useAuth(cloudConfig));
    await waitFor(() => expect(result.current.authLoading).toBe(false));

    let ok;
    await act(async () => {
      ok = await result.current.login("pau@grenoucerie.com", "mal");
    });

    expect(ok).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.authError).toBe("Invalid login credentials");
  });

  it("logout limpia la sesion", async () => {
    mockAuth.getSession.mockResolvedValue(conSesion());
    mockAuth.signOut.mockResolvedValue({});
    const { result } = renderHook(() => useAuth(cloudConfig));
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
  });
});
