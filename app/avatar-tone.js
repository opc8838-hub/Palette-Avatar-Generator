/** Pure tone transform, shared by previews and PNG export. */
export function hexRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

export function tonePixel(r, g, b, background, mode = 'neutral', strength = .32) {
  const luminance = .2126 * r + .7152 * g + .0722 * b;
  if (mode === 'neutral') return [luminance, luminance, luminance];
  const bgY = .2126 * background[0] + .7152 * background[1] + .0722 * background[2];
  // Fade tint into deep shadows and highlights, preserving facial contrast.
  const weight = Math.pow(Math.sin(Math.PI * luminance / 255), .65) * strength;
  return background.map((channel) => Math.max(0, Math.min(255, luminance + (channel - bgY) * weight)));
}

export function recolorPixels(input, hex, mode, strength) {
  const output = new Uint8ClampedArray(input.length);
  if (mode === 'original') return new Uint8ClampedArray(input);
  const bg = hexRgb(hex);
  const bgY = .2126 * bg[0] + .7152 * bg[1] + .0722 * bg[2];
  const dr = bg[0] - bgY, dg = bg[1] - bgY, db = bg[2] - bgY;
  // The curve is fixed for every pixel; precompute it once per color update
  // instead of calling sin/pow for every pixel on the main thread.
  const tintCurve = new Float32Array(256);
  for (let level = 0; level < tintCurve.length; level += 1) {
    tintCurve[level] = Math.pow(Math.sin(Math.PI * level / 255), .65) * strength;
  }
  for (let i = 0; i < input.length; i += 4) {
    const l = .2126 * input[i] + .7152 * input[i + 1] + .0722 * input[i + 2];
    const w = mode === 'neutral' ? 0 : tintCurve[Math.round(l)];
    output[i] = l + dr * w; output[i + 1] = l + dg * w; output[i + 2] = l + db * w;
    output[i + 3] = input[i + 3];
  }
  return output;
}
