import { describe, expect, it } from 'vitest';
import { displayUrl, hashString, hostOf, isAnalyzable, normalizeUrl, sanitizeFolderName, urlKey } from '../lib/url';

describe('normalizeUrl', () => {
  it('removes tracking params, hash and trailing slash', () => {
    expect(
      normalizeUrl('https://Example.com/Path/?utm_source=x&utm_medium=y&id=7#section'),
    ).toBe('https://example.com/Path?id=7');
  });

  it('keeps meaningful query params', () => {
    expect(normalizeUrl('https://x.com/user/status/123?s=20')).toBe(
      'https://x.com/user/status/123?s=20',
    );
  });

  it('drops default ports', () => {
    expect(normalizeUrl('https://example.com:443/a')).toBe('https://example.com/a');
  });

  it('keeps unparseable values as-is', () => {
    expect(normalizeUrl('not a url')).toBe('not a url');
  });
});

describe('urlKey', () => {
  it('is stable for equivalent URLs', () => {
    expect(urlKey('https://example.com/a/?utm_source=newsletter')).toBe(
      urlKey('https://example.com/a'),
    );
  });

  it('differs for different pages', () => {
    expect(urlKey('https://example.com/a')).not.toBe(urlKey('https://example.com/b'));
  });

  it('hash is deterministic', () => {
    expect(hashString('tidee')).toBe(hashString('tidee'));
  });
});

describe('isAnalyzable', () => {
  it('accepts http and https', () => {
    expect(isAnalyzable('https://example.com')).toBe(true);
    expect(isAnalyzable('http://localhost:3000')).toBe(true);
  });

  it('rejects browser and app protocols', () => {
    expect(isAnalyzable('edge://favorites')).toBe(false);
    expect(isAnalyzable('chrome://extensions')).toBe(false);
    expect(isAnalyzable('file:///C:/tmp/a.html')).toBe(false);
    expect(isAnalyzable('javascript:void(0)')).toBe(false);
  });
});

describe('display helpers', () => {
  it('strips www from hosts', () => {
    expect(hostOf('https://www.figma.com/file/abc')).toBe('figma.com');
  });

  it('shortens long URLs', () => {
    expect(displayUrl('https://example.com/' + 'a'.repeat(120), 40)).toHaveLength(40);
  });
});

describe('sanitizeFolderName', () => {
  it('removes characters Windows and Edge dislike', () => {
    expect(sanitizeFolderName('a/b\\c:d*e?f"g<h>i|j')).toBe('a b c d e f g h i j');
  });

  it('falls back for empty names', () => {
    expect(sanitizeFolderName('  ', '未分类')).toBe('未分类');
  });

  it('caps length', () => {
    expect(sanitizeFolderName('x'.repeat(100)).length).toBe(40);
  });
});
