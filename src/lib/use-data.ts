import { useCallback, useEffect, useState } from "react";
import { api, errorMsg } from "./api";

/** Carga datos de la API con estado de carga/error y función para recargar. */
export function useData<T>(url: string | null) {
  const [tick, setTick] = useState(0);
  const key = url ? `${url}#${tick}` : null;
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!url || !key) return;
    let cancel = false;
    api
      .get<T>(url)
      .then((data) => !cancel && setState({ key, data, error: null }))
      .catch((e) => !cancel && setState((s) => ({ key, data: s.data, error: errorMsg(e) })));
    return () => {
      cancel = true;
    };
  }, [url, key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  // Mientras recarga se siguen mostrando los datos anteriores (sin parpadeo)
  const loading = !!key && state.key !== key;
  return { data: state.data, error: state.error, loading, reload };
}

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("renacer-tema", next ? "oscuro" : "claro");
    } catch {
      /* sin almacenamiento */
    }
    setDark(next);
  };
  return { dark, toggle };
}
