import { createClient } from "@supabase/supabase-js";

let _client = null;

export const getSupabaseClient = (url, key) => {
  if (!url || !key) return null;
  if (_client && _client._url === url) return _client;
  _client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  _client._url = url;
  return _client;
};
