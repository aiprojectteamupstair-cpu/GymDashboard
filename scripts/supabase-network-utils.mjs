export function normalizeEndpoint(input) {
  if (!input) throw new Error('Provide the project URL as an argument or set VITE_SUPABASE_URL.');
  const url=new URL(input);
  if (url.protocol!=='https:' || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTPS project URL without credentials, query parameters or a fragment.');
  if (url.pathname==='/' || url.pathname==='') url.pathname='/rest/v1/';
  if (url.pathname.replace(/\/$/,'')!=='/rest/v1') throw new Error('Use the project origin or its /rest/v1/ endpoint.');
  return url;
}

export function isMissingApiKey(status,body) {
  if (status!==401) return false;
  try { return /no api key/i.test(JSON.parse(body).message || ''); }
  catch { return false; }
}
