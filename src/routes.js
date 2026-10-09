export const PAGE_PATHS = Object.freeze({
  dashboard: '/',
  members: '/members',
  checkin: '/check-in',
  analytics: '/analytics',
  catalogue: '/packages-discounts',
  accounts: '/staff-accounts',
});

export function memberPath(id) {
  return `${PAGE_PATHS.members}/${encodeURIComponent(id)}`;
}

export function resolveRoute(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const page = Object.keys(PAGE_PATHS).find(key => PAGE_PATHS[key] === path);
  if (page) return { page, memberId: null, path };
  const match = /^\/members\/([^/]+)$/.exec(path);
  if (match) {
    try {
      const memberId = decodeURIComponent(match[1]);
      if (/^[A-Za-z0-9_-]+$/.test(memberId)) return { page: 'members', memberId, path: memberPath(memberId) };
    } catch { /* Malformed URL encoding is a not-found route. */ }
  }
  return { page: 'not-found', memberId: null, path: pathname };
}

export function isPlainNavigation(event) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
