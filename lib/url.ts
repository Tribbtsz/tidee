const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_name',
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'ref_src',
  'ref_url',
  'spm',
  'scm',
  'from_source',
];

const NON_WEB_PROTOCOLS = [
  'chrome:',
  'edge:',
  'about:',
  'file:',
  'data:',
  'javascript:',
  'view-source:',
  'mailto:',
  'tel:',
];

export function normalizeUrl(input: string): string {
  const raw = (input || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if (
      (url.protocol === 'https:' && url.port === '443') ||
      (url.protocol === 'http:' && url.port === '80')
    ) {
      url.port = '';
    }
    for (const key of TRACKING_PARAMS) url.searchParams.delete(key);
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    if (url.pathname === '/') url.pathname = '';
    if (!url.search) url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return raw;
  }
}

export function isAnalyzable(url: string): boolean {
  const value = (url || '').trim().toLowerCase();
  if (!value) return false;
  if (NON_WEB_PROTOCOLS.some((prefix) => value.startsWith(prefix))) return false;
  return value.startsWith('http://') || value.startsWith('https://');
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function displayUrl(url: string, max = 72): string {
  try {
    const parsed = new URL(url);
    const value = `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname}${parsed.search}`;
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  } catch {
    return url.length > max ? `${url.slice(0, max - 1)}…` : url;
  }
}

/** cyrb53: fast, stable, non-cryptographic string hash. */
export function hashString(value: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function urlKey(url: string): string {
  const normalized = normalizeUrl(url);
  return `u_${hashString(normalized)}_${normalized.length.toString(36)}`;
}

export function sanitizeFolderName(name: string, fallback = '未分类'): string {
  const cleaned = (name || '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return cleaned || fallback;
}

export function truncate(value: string, max: number): string {
  const text = (value || '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
