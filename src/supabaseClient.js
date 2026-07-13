import { createClient } from "@supabase/supabase-js";

// Cliente único (singleton) reutilizado mientras la URL no cambie.
// Solo se usa para autenticación (login/sesión); las lecturas/escrituras de
// datos siguen haciéndose con fetch directo contra /rest/v1/ como hasta ahora,
// para no tocar esa parte que ya funciona.
let _client = null;

export const getSupabaseClient = (url, key) => {
  if (!url || !key) return null;
  if (_client && _client._grenoucerieUrl === url) return _client;
  _client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "grenoucerie_auth",
    },
  });
  _client._grenoucerieUrl = url;
  return _client;
};
