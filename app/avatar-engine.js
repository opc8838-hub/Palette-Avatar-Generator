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

export async function loadDefaultPortrait() {
  const image = await decode(`${import.meta.env.BASE_URL}assets/avatar/default-portrait-cutout.png`);
  const out = canvas(image.naturalWidth, image.naturalHeight);
  highQuality(out.getContext('2d')).drawImage(image, 0, 0);
  return { canvas: out, name: '默认人物.png' };
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

export const BACK_TEXT_FONTS = [
  { id: 'display', label: 'Duo Display · 粗体', family: "'Duo Display','Microsoft YaHei',sans-serif", weight: 700 },
  { id: 'sans', label: '现代黑体', family: "'Microsoft YaHei','PingFang SC',sans-serif", weight: 700 },
  { id: 'serif', label: '衬线体', family: "Georgia,'SimSun',serif", weight: 700 },
  { id: 'cinzel', label: 'Cinzel', family: "'Cinzel','Microsoft YaHei',serif", weight: 700 },
  { id: 'fraunces', label: 'Fraunces', family: "'Fraunces','Microsoft YaHei',serif", weight: 700 },
  { id: 'instrument', label: 'Instrument Serif', family: "'Instrument Serif','Microsoft YaHei',serif", weight: 400 },
  { id: 'league', label: 'League Spartan', family: "'League Spartan','Microsoft YaHei',sans-serif", weight: 700 },
  { id: 'lora', label: 'Lora', family: "'Lora','Microsoft YaHei',serif", weight: 700 },
  { id: 'manrope', label: 'Manrope', family: "'Manrope','Microsoft YaHei',sans-serif", weight: 700 },
  { id: 'martian', label: 'Martian Mono', family: "'Martian Mono','Microsoft YaHei',monospace", weight: 700 },
  { id: 'space', label: 'Space Grotesk', family: "'Space Grotesk','Microsoft YaHei',sans-serif", weight: 700 },
];

export function drawBackText(ctx, size, textLayer = {}) {
  const text = String(textLayer.text || '').trim();
  if (!text) return;
  const font = BACK_TEXT_FONTS.find((item) => item.id === textLayer.font) || BACK_TEXT_FONTS[0];
  const lines = text.split(/\r?\n/).slice(0, 8);
  ctx.save();
  ctx.fillStyle = textLayer.color || '#111111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const requestedSize = Math.max(24, Math.min(320, Number(textLayer.size) || 128)) * size / 1024;
  ctx.font = `${font.weight} ${requestedSize}px ${font.family}`;
  const widest = Math.max(1, ...lines.map((line) => ctx.measureText(line).width));
  const actualSize = requestedSize * Math.min(1, size * .9 / widest);
  ctx.font = `${font.weight} ${actualSize}px ${font.family}`;
  const centerX = size * (.5 + (Number(textLayer.x) || 0));
  const centerY = size * (.5 + (Number(textLayer.y) || 0));
  const lineHeight = actualSize * 1.05;
  lines.forEach((line, index) => ctx.fillText(line, centerX, centerY + (index - (lines.length - 1) / 2) * lineHeight));
  ctx.restore();
}

export function renderPreparedAvatar(layers, { color, mode, strength = .32, size = layers.size, textLayer }) {
  const out = canvas(size), ctx = highQuality(out.getContext('2d'));
  ctx.fillStyle = color; ctx.fillRect(0, 0, size, size);
  drawBackText(ctx, size, textLayer);
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

export function renderPortraitScreens(primary, { compare = false, secondary = primary, textLayer } = {}) {
  const inner = canvas(1335, 939), outer = canvas(630, 917);
  const innerContext = inner.getContext('2d'), outerContext = outer.getContext('2d');
  const compose = (portrait) => {
    if (!textLayer?.text?.trim()) return portrait;
    const layer = canvas(portrait.width, portrait.height), ctx = layer.getContext('2d');
    drawBackText(ctx, layer.width, textLayer);
    ctx.drawImage(portrait, 0, 0);
    return layer;
  };
  const first = compose(primary), second = secondary === primary ? first : compose(secondary);
  if (compare) {
    drawPortraitContained(innerContext, first, 0, 0, inner.width / 2, inner.height);
    drawPortraitContained(innerContext, second, inner.width / 2, 0, inner.width / 2, inner.height);
    innerContext.fillStyle = '#FFFFFF'; innerContext.fillRect(inner.width / 2 - 2, 0, 4, inner.height);
  } else {
    drawPortraitContained(innerContext, first, 0, 0, inner.width, inner.height);
  }
  drawPortraitContained(outerContext, first, 0, 0, outer.width, outer.height);
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
