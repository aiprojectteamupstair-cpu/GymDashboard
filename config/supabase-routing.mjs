export function supabaseRouting(env, command, rewrites=[]) {
  const enabled=env.VITE_SUPABASE_USE_SAME_ORIGIN_PROXY==='true';
  if (!enabled) return {};
  if (!env.VITE_SUPABASE_URL) throw new Error('Same-origin proxy requires VITE_SUPABASE_URL as its upstream project origin.');
  const url=new URL(env.VITE_SUPABASE_URL);
  if (url.protocol!=='https:' || url.username || url.password || url.search || url.hash || url.pathname!=='/') throw new Error('VITE_SUPABASE_URL must be an HTTPS project origin, without a path or credentials.');
  if (command==='build') {
    const destination=rewrites.find(row=>row.source==='/supabase/:path*')?.destination;
    if (destination!==`${url.origin}/:path*`) throw new Error('Vercel /supabase rewrite does not match VITE_SUPABASE_URL. Update vercel.json or disable VITE_SUPABASE_USE_SAME_ORIGIN_PROXY.');
    return {};
  }
  return {
    '^/supabase(?:/|$)': {
      target:url.origin, changeOrigin:true, secure:true, ws:true,
      rewrite:path=>path.replace(/^\/supabase(?=\/|$)/,'') || '/',
      proxyTimeout:15000, timeout:20000,
    },
  };
}
