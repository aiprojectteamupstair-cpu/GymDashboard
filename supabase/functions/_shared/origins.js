export function allowedOrigins() {
  const local = ['http://127.0.0.1', 'http://localhost'].flatMap(host =>
    [3000, 3001, 4173, 4174].map(port => `${host}:${port}`));
  const configured = (globalThis.Deno?.env.get('ALLOWED_ORIGINS') || '')
    .split(',').map(value => value.trim()).filter(Boolean);
  return [...local, ...configured];
}
