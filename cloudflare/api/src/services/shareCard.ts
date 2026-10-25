import {initWasm, Resvg} from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import boldFont from '../assets/Prompt-Bold.ttf';
import regularFont from '../assets/Prompt-Regular.ttf';
import {uploadBytes} from './storage';

let ready: Promise<void> | null = null;

function init(): Promise<void> {
  ready ??= initWasm(resvgWasm).catch(err => {
    ready = null;
    throw err;
  });
  return ready;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Python slicing by code points: text[:n] */
const cut = (s: string, n: number) => Array.from(s).slice(0, n).join('');

const rgb = (c: number[]) => `rgb(${c.join(',')})`;

/** Renders a share card PNG, stores it with the other uploads and returns its public URL. */
export async function generateShareCard(
  env: Env,
  opts: {kind: 'lost' | 'found'; title: string; subtitle: string; location: string; dateText: string; keySuffix: string},
): Promise<string> {
  const width = 1080;
  const height = 1350;
  const bg = opts.kind === 'lost' ? [253, 233, 233] : [230, 246, 243];
  const accent = opts.kind === 'lost' ? [216, 64, 64] : [15, 118, 110];
  const badge = opts.kind === 'lost' ? 'LOST PET' : 'FOUND PET';
  // Pillow draws text from the top-left corner; SVG baselines sit roughly 0.8em lower.
  const text = (x: number, top: number, size: number, color: number[], value: string, weight = 700) =>
    `<text x="${x}" y="${top + Math.round(size * 0.8)}" font-family="Prompt" font-weight="${weight}" font-size="${size}" fill="${rgb(color)}">${esc(value)}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${rgb(bg)}"/>
  <rect x="60" y="60" width="${width - 120}" height="${height - 120}" rx="48" fill="#ffffff"/>
  <rect x="120" y="140" width="340" height="90" rx="24" fill="${rgb(accent)}"/>
  ${text(150, 160, 42, [255, 255, 255], badge)}
  ${text(120, 300, 72, [28, 40, 36], cut(opts.title, 40))}
  ${text(120, 420, 40, [90, 110, 104], cut(opts.subtitle, 60), 400)}
  ${text(120, 560, 28, [140, 150, 146], 'Last seen / Found at', 400)}
  ${text(120, 620, 44, [28, 40, 36], cut(opts.location || '—', 70))}
  ${text(120, 760, 36, [90, 110, 104], cut(opts.dateText, 40), 400)}
  ${text(120, 1100, 32, accent, 'Pet haii · Help pets get home')}
</svg>`;

  await init();
  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: [new Uint8Array(boldFont), new Uint8Array(regularFont)],
      defaultFontFamily: 'Prompt',
      loadSystemFonts: false,
    },
  });
  const png = resvg.render().asPng();
  resvg.free();
  return uploadBytes(env, `${opts.keySuffix}.png`, png, 'image/png');
}
