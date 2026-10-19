import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const base = process.env.CDP_BASE || 'http://127.0.0.1:9223';
const mode = process.argv[2] || 'inspect';
const arg = process.argv[3] || '';
const out = process.argv[4] || '';

const targets = await (await fetch(`${base}/json/list`)).json();
const match = process.env.CDP_MATCH || '';
const target =
  (match
    ? targets.find((item) => item.type === 'page' && item.url.includes(match))
    : undefined) ||
  targets.find((item) => item.type === 'page' && item.url.includes('tidee')) ||
  targets.find((item) => item.type === 'page' && item.url.includes('chrome-extension://')) ||
  targets.find((item) => item.type === 'page');

if (!target) {
  console.error('no page target');
  process.exit(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const events = [];

ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    events.push(`EXCEPTION: ${message.params.exceptionDetails.text} ${message.params.exceptionDetails.exception?.description ?? ''}`);
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    events.push(`CONSOLE: ${message.params.args.map((item) => item.value ?? item.description).join(' ')}`);
  }
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: Number(process.env.CDP_WIDTH || 1440),
  height: Number(process.env.CDP_HEIGHT || 1000),
  deviceScaleFactor: 1,
  mobile: false,
});

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

if (mode === 'reload') {
  await send('Page.reload', { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 1600));
}

if (mode === 'eval') {
  const value = await evaluate(arg);
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

if (mode === 'evalfile') {
  const value = await evaluate(readFileSync(arg, 'utf8'));
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

if (mode === 'screenshot' || mode === 'inspect') {
  await new Promise((resolve) => setTimeout(resolve, 900));
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log(`saved ${out}`);
  }
}

if (mode === 'inspect') {
  const text = await evaluate('document.body.innerText');
  console.log('--- text ---');
  console.log(text);
  console.log('--- events ---');
  console.log(events.length ? events.join('\n') : '(none)');
  console.log('--- state ---');
  console.log(
    await evaluate(`JSON.stringify({
      title: document.title,
      url: location.href,
      ready: document.readyState,
      cards: document.querySelectorAll('.bm-card').length,
      rows: document.querySelectorAll('article').length,
      sidebar: !!document.querySelector('.sidebar'),
      bodyWidth: document.body.scrollWidth,
      theme: document.documentElement.dataset.theme,
    })`),
  );
}

ws.close();
process.exit(0);
