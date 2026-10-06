/** Approved sample illustrations, their own region masks, and browser-only composition. */
import regions from '../assets/illustrations/regions.json';
import makeup from '../assets/illustrations/makeup.json';

export const ILLUSTRATION_STYLES = ['line', 'solid', 'color'];
export const ILLUSTRATION_SUBJECTS = ['male', 'woman'];
const SIZE = 1254;
function canvas() { const out = document.createElement('canvas'); out.width = out.height = SIZE; return out; }
function exterior(data, threshold) {
  const seen = new Uint8Array(SIZE * SIZE), queue = new Int32Array(SIZE * SIZE);
  let head = 0, tail = 0;
  const visit = (i) => {
    if (i < 0 || i >= seen.length || seen[i]) return;
    seen[i] = 1;
    const o = i * 4;
    if (Math.min(data[o], data[o + 1], data[o + 2]) < threshold) return;
    queue[tail++] = i;
  };
  // Start from all edges; closed person contours protect skin and white clothes.
  for (let i = 0; i < SIZE; i++) { visit(i); visit((SIZE - 1) * SIZE + i); visit(i * SIZE); visit(i * SIZE + SIZE - 1); }
  while (head < tail) { const i = queue[head++], x = i % SIZE; visit(i - SIZE); visit(i + SIZE); if (x) visit(i - 1); if (x < SIZE - 1) visit(i + 1); }
  return queue.subarray(0, tail);
}
async function loadAsset(subject, version) {
  const image = new Image(); image.src = `${import.meta.env.BASE_URL}assets/illustrations/${subject}-${version}.png`;
  await image.decode();
  const out = canvas(), ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, SIZE, SIZE); ctx.drawImage(image, 0, 0, SIZE, SIZE);
  const frame = ctx.getImageData(0, 0, SIZE, SIZE);
  // Light gray is actual Line artwork, so only near-white pixels are eligible.
  for (const i of exterior(frame.data, version === 'line' ? 248 : 185)) frame.data[i * 4 + 3] = 0;
  ctx.putImageData(frame, 0, 0);
  return out;
}
let assetsPromise;
export function loadIllustrations() {
  if (!assetsPromise) assetsPromise = Promise.all(ILLUSTRATION_SUBJECTS.map(async subject => [subject, { line: await loadAsset(subject, 'line'), solid: await loadAsset(subject, 'solid') }])).then(entries => Object.fromEntries(entries)).catch(error => { assetsPromise = null; throw error; });
  return assetsPromise;
}
export function illustrationParts(subject) { return regions.subjects[subject].parts.filter(part => part.kind !== 'background'); }
const masks = new WeakMap();
function materialMask(part) {
  if (!masks.has(part)) { const out = canvas(), ctx = out.getContext('2d'); ctx.fillStyle = 'white'; for (const d of part.paths) ctx.fill(new Path2D(d)); masks.set(part, ctx.getImageData(0, 0, SIZE, SIZE).data); }
  return masks.get(part);
}
export function composeIllustration(assets, { subject = 'male', style = 'color', materials = {}, blush, lips }) {
  const base = assets?.[subject]?.[style === 'line' ? 'line' : 'solid'];
  if (!base) return null;
  const out = canvas(), ctx = out.getContext('2d', { willReadFrequently: true }); ctx.drawImage(base, 0, 0);
  if (style === 'color') {
    const frame = ctx.getImageData(0, 0, SIZE, SIZE);
    for (const part of illustrationParts(subject)) {
      const color = materials[part.id]; if (!/^#[a-f\d]{6}$/i.test(color || '')) continue;
      const mask = materialMask(part), rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
      for (let o = 0; o < frame.data.length; o += 4) {
        if (!mask[o + 3] || !frame.data[o + 3] || Math.min(frame.data[o], frame.data[o + 1], frame.data[o + 2]) < (part.preserveDarkerThan || 0)) continue;
        const alpha = mask[o + 3] / 255;
        for (let c = 0; c < 3; c++) frame.data[o + c] = Math.round(frame.data[o + c] * (1 - alpha + alpha * rgb[c] / 255));
      }
    }
    ctx.putImageData(frame, 0, 0);
  }
  if (style !== 'line') {
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    for (const [name, settings] of [['blush', blush], ['lips', lips]]) {
      if (!settings?.on) continue;
      ctx.fillStyle = settings.color; ctx.globalAlpha = settings.strength / 100;
      if (name === 'blush') for (const [x, y, r] of makeup[subject].cheeks) { ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill(); }
      else for (const d of makeup[subject].lips) ctx.fill(new Path2D(d));
    }
    ctx.restore();
  }
  return { canvas: out, name: subject === 'male' ? '男生手绘样例' : '女生手绘样例' };
}
