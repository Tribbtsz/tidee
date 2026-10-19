const urls = process.argv.slice(2);

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0';

function decode(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function meta(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decode(match[1]).slice(0, 220);
  }
  return '';
}

for (const url of urls) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    });
    const html = await response.text();
    const title = meta(html, [/<title[^>]*>(.*?)<\/title>/is]);
    const description = meta(html, [
      /<meta[^>]+name=["']description["'][^>]+content=["'](.*?)["']/is,
      /<meta[^>]+content=["'](.*?)["'][^>]+name=["']description["']/is,
      /<meta[^>]+property=["']og:description["'][^>]+content=["'](.*?)["']/is,
      /<meta[^>]+content=["'](.*?)["'][^>]+property=["']og:description["']/is,
    ]);
    console.log(
      JSON.stringify({
        url,
        status: response.status,
        bytes: html.length,
        ms: Date.now() - started,
        title,
        description,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        url,
        status: 0,
        ms: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
