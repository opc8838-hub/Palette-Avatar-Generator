/** Browser-only photo decoding, matte generation and deterministic composition. */
import { recolorPixels } from './avatar-tone.js';

export function canvas(width, height = width) {
  const result = document.createElement('canvas');
  result.width = width; result.height = height;
  return result;
}

function highQuality(ctx) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

async function decode(src) {
  const image = new Image(); image.src = src;
  await image.decode(); return image;
}

export async function loadReference(which = 'pink') {
  const image = await decode(`${import.meta.env.BASE_URL}assets/avatar/reference-${which}.png`);
  // The references are screenshots. Keep every pixel of their circular photo
  // instead of shrinking it before the phone and export pipelines use it.
  const n = 1090, out = canvas(n), ctx = highQuality(out.getContext('2d'));
  ctx.drawImage(image, 97, 846, n, n, 0, 0, n, n);
  const pixels = ctx.getImageData(0, 0, n, n);
  const bg = which === 'pink' ? [247, 188, 218] : [197, 225, 213];
  const total = n * n, visited = new Uint8Array(total), queue = new Int32Array(total);
  let start = 0, end = 0;
  const distance = (p) => {
    const offset = p * 4;
    return Math.hypot(pixels.data[offset] - bg[0], pixels.data[offset + 1] - bg[1], pixels.data[offset + 2] - bg[2]);
  };
  const enqueue = (p) => { if (!visited[p] && distance(p) < 42) { visited[p] = 1; queue[end++] = p; } };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x - n / 2, y - n / 2);
    if (d > n / 2 - 5) {
      if (d <= n / 2) enqueue(y * n + x);
      else pixels.data[(y * n + x) * 4 + 3] = 0;
    }
  }
  while (start < end) {
    const p = queue[start++], x = p % n;
    if (x > 0) enqueue(p - 1); if (x < n - 1) enqueue(p + 1);
    if (p >= n) enqueue(p - n); if (p < total - n) enqueue(p + n);
  }
  for (let p = 0; p < total; p++) if (visited[p]) {
    const alpha = Math.max(0, Math.min(1, (distance(p) - 4) / 35));
    pixels.data[p * 4 + 3] = Math.round(pixels.data[p * 4 + 3] * alpha);
    // Undo the pink/green color mixed into antialiased silhouette pixels.
    // Without this, the old backdrop leaves a visible rim on new colors.
    if (alpha > .15 && alpha < 1) for (let k = 0; k < 3; k++) {
      const index = p * 4 + k;
      pixels.data[index] = Math.max(0, Math.min(255, (pixels.data[index] - (1 - alpha) * bg[k]) / alpha));
    }
  }
  // Remove the screenshot's dark circular boundary without erasing skin that
  // shares the backdrop's tint. These coordinates apply only to the two demos.
  for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
    const edge = n / 2 - 5 - Math.hypot(px - n / 2, py - n / 2);
    pixels.data[(py * n + px) * 4 + 3] *= Math.max(0, Math.min(1, edge));
  }
  ctx.putImageData(pixels, 0, 0);
  return { canvas: out, name: which === 'pink' ? '参考人物 A' : '参考人物 B', reference: true };
}

let segmenterPromise;
async function getSegmenter() {
  if (!segmenterPromise) segmenterPromise = (async () => {
    const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
    const files = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}assets/avatar/wasm`);
    return ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: `${import.meta.env.BASE_URL}assets/avatar/selfie_segmenter.tflite`, delegate: 'CPU' },
      runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true,
    });
  })().catch((error) => { segmenterPromise = null; throw error; });
  return segmenterPromise;
}

export async function loadPortrait(file, onStatus = () => {}) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) throw Error('请选择 JPG、PNG、WebP 或 AVIF 图片。');
  if (file.size > 25 * 1024 * 1024) throw Error('请选择小于 25 MB 的照片。');
  const url = URL.createObjectURL(file);
  try {
    const image = await decode(url);
    // Keep a detailed master for the PNG and phone. Segmentation runs on a
    // separate smaller canvas so larger uploads do not stall the UI as long.
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    const out = canvas(Math.round(image.naturalWidth * scale), Math.round(image.naturalHeight * scale));
    const ctx = highQuality(out.getContext('2d', { willReadFrequently: true }));
    ctx.drawImage(image, 0, 0, out.width, out.height);
    const pixels = ctx.getImageData(0, 0, out.width, out.height);
    let transparent = 0;
    for (let i = 3; i < pixels.data.length; i += 4) if (pixels.data[i] < 20) transparent++;
    if (transparent / (out.width * out.height) > .02) return { canvas: out, name: file.name };
    onStatus('正在分离人像…');
    const segmenter = await getSegmenter();
    const segmentationScale = Math.min(1, 1024 / Math.max(out.width, out.height));
    const segmentationInput = canvas(Math.max(1, Math.round(out.width * segmentationScale)), Math.max(1, Math.round(out.height * segmentationScale)));
    highQuality(segmentationInput.getContext('2d')).drawImage(out, 0, 0, segmentationInput.width, segmentationInput.height);
    const result = segmenter.segment(segmentationInput);
    try {
      // The binary selfie model returns one foreground confidence mask.
      const mask = result.confidenceMasks.at(-1);
      const values = mask.getAsFloat32Array();
      const matte = canvas(mask.width, mask.height), mctx = matte.getContext('2d');
      const md = mctx.createImageData(mask.width, mask.height);
      let foreground = 0;
      for (let i = 0; i < values.length; i++) {
        // Tighten the uncertain band. The former .18–.85 ramp left a broad,
        // visibly soft halo, especially around shoulders and dark hair.
        const t = Math.max(0, Math.min(1, (values[i] - .3) / .46));
        const a = t * t * (3 - 2 * t);
        foreground += a;
        md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = 255;
        md.data[i * 4 + 3] = Math.round(a * 255);
      }
      if (foreground / values.length < .015) throw Error('没有识别到清晰人像，请换一张正面照片。');
      mctx.putImageData(md, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      highQuality(ctx).drawImage(matte, 0, 0, out.width, out.height);
      ctx.globalCompositeOperation = 'source-over';
    } finally { result.close(); }
    return { canvas: out, name: file.name };
  } finally { URL.revokeObjectURL(url); }
}

export function prepareAvatarLayers(source, { zoom = 1, x = 0, y = 0, size = 1024 } = {}) {
  const original = canvas(size), ctx = highQuality(original.getContext('2d', { willReadFrequently: true }));
  if (source) {
    const scale = Math.max(size / source.width, size / source.height) * zoom;
    const width = source.width * scale, height = source.height * scale;
    ctx.drawImage(source, (size - width) / 2 + x * size, (size - height) / 2 + y * size, width, height);
  }
  const sourcePixels = ctx.getImageData(0, 0, size, size);
  const neutral = canvas(size);
  neutral.getContext('2d').putImageData(
    new ImageData(recolorPixels(sourcePixels.data, '#000000', 'neutral', 1), size, size),
    0,
    0,
  );
  const previewSize = 240;
  const previewSource = canvas(previewSize), previewContext = previewSource.getContext('2d', { willReadFrequently: true });
  highQuality(previewContext).drawImage(original, 0, 0, previewSize, previewSize);
  return { original, neutral, sourcePixels, previewPixels: previewContext.getImageData(0, 0, previewSize, previewSize), previewSize, size };
}

export function renderPreparedAvatar(layers, { color, mode, strength = .32, size = layers.size }) {
  const out = canvas(size), ctx = highQuality(out.getContext('2d'));
  ctx.fillStyle = color; ctx.fillRect(0, 0, size, size);
  if (!layers.original) return out;
  if (mode === 'original') ctx.drawImage(layers.original, 0, 0, size, size);
  else if (mode === 'neutral') ctx.drawImage(layers.neutral, 0, 0, size, size);
  else {
    const tinted = canvas(size);
    tinted.getContext('2d').putImageData(
      new ImageData(recolorPixels((size === layers.previewSize ? layers.previewPixels : layers.sourcePixels).data, color, mode, strength), size, size),
      0,
      0,
    );
    ctx.drawImage(tinted, 0, 0);
  }
  return out;
}

export function renderAvatar(source, options) {
  const layers = prepareAvatarLayers(source, options);
  return renderPreparedAvatar(layers, options);
}

function drawContained(ctx, image, x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
  // Leave breathing room around a portrait when the square composition is
  // displayed on the much wider inner screen. Never crop the source image.
  const scale = Math.min(width / image.width, height / image.height) * .78;
  const drawWidth = image.width * scale, drawHeight = image.height * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawPortraitContained(ctx, image, x, y, width, height) {
  highQuality(ctx);
  const scale = Math.min(width / image.width, height / image.height) * .78;
  const drawWidth = image.width * scale, drawHeight = image.height * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

export function renderPortraitScreens(primary, { compare = false, secondary = primary } = {}) {
  const inner = canvas(1335, 939), outer = canvas(630, 917);
  const innerContext = inner.getContext('2d'), outerContext = outer.getContext('2d');
  if (compare) {
    drawPortraitContained(innerContext, primary, 0, 0, inner.width / 2, inner.height);
    drawPortraitContained(innerContext, secondary, inner.width / 2, 0, inner.width / 2, inner.height);
    innerContext.fillStyle = '#FFFFFF'; innerContext.fillRect(inner.width / 2 - 2, 0, 4, inner.height);
  } else {
    drawPortraitContained(innerContext, primary, 0, 0, inner.width, inner.height);
  }
  drawPortraitContained(outerContext, primary, 0, 0, outer.width, outer.height);
  return { inner, outer };
}

export function renderScreens(tinted, neutral, { color, mode, compare, original = neutral }) {
  const inner = canvas(1335, 939), outer = canvas(630, 917);
  for (const [screen, isInner] of [[inner, true], [outer, false]]) {
    const ctx = screen.getContext('2d'), w = screen.width, h = screen.height;
    if (isInner && compare) {
      drawContained(ctx, tinted, 0, 0, w / 2, h, color);
      const comparison = mode === 'original' ? original : neutral;
      drawContained(ctx, comparison, w / 2, 0, w / 2, h, color);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(w / 2 - 2, 0, 4, h);
    } else {
      drawContained(ctx, mode === 'tint' ? tinted : mode === 'original' ? original : neutral, 0, 0, w, h, color);
    }
  }
  return { inner, outer };
}

export async function downloadAvatar(source, options) {
  const output = renderAvatar(source, { ...options, size: 1024 });
  const blob = await new Promise((resolve, reject) => output.toBlob((b) => b ? resolve(b) : reject(Error('图片导出失败，请重试。')), 'image/png'));
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `tone-duo-${options.color.slice(1)}-${options.mode}-square.png`;
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
