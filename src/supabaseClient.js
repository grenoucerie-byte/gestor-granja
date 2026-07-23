import { createClient } from "@supabase/supabase-js";

// Cliente único (singleton) reutilizado mientras la URL no cambie.
// Solo se usa para autenticación (login/sesión); las lecturas/escrituras de
// datos siguen haciéndose con fetch directo contra /rest/v1/ como hasta ahora,
// para no tocar esa parte que ya funciona.
let _client = null;

export const getSupabaseClient = (url, key) => {
  if (!url || !key) return null;
  
  // Validar formato básico de URL
  const urlLimpiada = String(url).trim();
  if (!urlLimpiada.startsWith("http://") && !urlLimpiada.startsWith("https://")) {
    console.warn("URL de Supabase no válida:", urlLimpiada);
    return null;
  }

  if (_client && _client._grenoucerieUrl === urlLimpiada) return _client;
  
  try {
    _client = createClient(urlLimpiada, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "grenoucerie_auth",
      },
    });
    _client._grenoucerieUrl = urlLimpiada;
    return _client;
  } catch (err) {
    console.error("Error al inicializar el cliente de Supabase:", err);
    return null;
  }
};
