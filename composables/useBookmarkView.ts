export function categoryHue(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  }
  // Muted stone / sage / slate hues. No yellow or orange.
  const hues = [152, 198, 258, 330, 6, 176, 214, 292];
  return hues[hash % hues.length]!;
}

export function categoryStyle(name: string): Record<string, string> {
  const hue = categoryHue(name);
  return {
    '--cat': `color-mix(in srgb, hsl(${hue} 11% 48%) 62%, var(--ink))`,
    '--cat-soft': `hsl(${hue} 11% 48% / 0.12)`,
  };
}

export function faviconUrl(url: string, size = 32): string {
  try {
    return chrome.runtime.getURL(
      `_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`,
    );
  } catch {
    return '';
  }
}

export function letterOf(bookmark: { url: string; title: string }): string {
  const host = (() => {
    try {
      return new URL(bookmark.url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })();
  return (host || bookmark.title || '?').slice(0, 1).toUpperCase();
}

export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return '高';
  if (confidence >= 0.6) return '中';
  return '低';
}
