/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { Usuario } from "@/lib/types";

type AuthCtx = {
  user: Usuario | null;
  loading: boolean;
  login: (usuario: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ user: Usuario }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    const expired = () => setUser(null);
    window.addEventListener("auth:expired", expired);
    return () => window.removeEventListener("auth:expired", expired);
  }, []);

  const login = async (usuario: string, password: string) => {
    const r = await api.post<{ user: Usuario }>("/auth/login", { usuario, password });
    setUser(r.user);
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fuera de AuthProvider");
  return ctx;
}

/** Usuario actual (solo dentro de rutas protegidas). */
export function useUser() {
  const { user } = useAuth();
  if (!user) throw new Error("Sin usuario");
  return user;
}
