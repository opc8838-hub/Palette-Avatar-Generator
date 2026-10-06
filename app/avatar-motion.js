/** Avatar grid motion: deterministic sampling shared by preview and offline export. */
export const MOTION_PRESETS = [
  ['wave', '波浪'], ['sweep', '扫光'], ['lens', '鱼眼'], ['burst', '爆发'],
  ['bloom', '绽放'], ['diamond', '菱形扩散'], ['radar', '雷达'], ['random', '随机亮起'],
  ['checker', '棋盘'], ['heartbeat', '心跳'], ['breathing', '呼吸'], ['pinwheel', '风车'],
];
export const MOTION_DEFAULTS = {
  grid: 5, gap: 6, shape: 'rounded', layout: 'mosaic', preset: 'wave',
  speed: 1, direction: 'right', originX: .5, originY: .5,
  colorMode: 'uniform', seed: 1, appearance: 'opacity', inactive: 'dim',
  glow: true, glowRange: 10, mask: Array(25).fill(true),
};

export function randomUnit(seed) {
  let value = (seed | 0) + 0x6D2B79F5;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
}

export function motionColors(settings, color, seriesColors, allColors) {
  const pool = settings.colorMode === 'all' ? allColors : seriesColors;
  return Array.from({ length: settings.grid ** 2 }, (_, index) =>
    settings.colorMode === 'uniform' || !pool.length ? color : pool[Math.floor(randomUnit(settings.seed * 997 + index * 37) * pool.length)],
  );
}

export function resizeMotionMask(mask, previous, next) {
  return Array.from({ length: next ** 2 }, (_, index) => {
    const row = Math.min(previous - 1, Math.floor((Math.floor(index / next) + .5) / next * previous));
    const col = Math.min(previous - 1, Math.floor((index % next + .5) / next * previous));
    return mask[row * previous + col] !== false;
  });
}

export function sampleAvatarMotion(settings, index, progress) {
  const wrap = (value) => (value % 1 + 1) % 1;
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const smooth = (value) => value * value * (3 - 2 * value);
  const hash = (value) => wrap(Math.sin(value * 127.1 + 311.7) * 43758.5453);
  const tau = Math.PI * 2, n = settings.grid, t = wrap(progress);
  const col = index % n, row = Math.floor(index / n);
  const x = col / Math.max(n - 1, 1), y = row / Math.max(n - 1, 1);
  const dx = x - settings.originX, dy = y - settings.originY;
  const farthest = Math.max(.1, Math.hypot(settings.originX, settings.originY), Math.hypot(1 - settings.originX, settings.originY), Math.hypot(settings.originX, 1 - settings.originY), Math.hypot(1 - settings.originX, 1 - settings.originY));
  const radial = Math.hypot(dx, dy) / farthest;
  const direction = { right: x, left: 1 - x, down: y, up: 1 - y, diagonal: (x + y) / 2 }[settings.direction] ?? x;
  const angle = Math.atan2(dy, dx) / tau;
  const band = (offset, width = .18) => {
    const distance = Math.abs(wrap(t - offset + .5) - .5);
    return Math.exp(-distance * distance / (2 * width * width));
  };
  let light;
  switch (settings.preset) {
    case 'sweep': light = band(direction * .72, .105); break;
    case 'lens': light = band(direction * .7 + radial * .08, .19); break;
    case 'burst': light = band(radial * .68, .1); break;
    case 'bloom': light = band(Math.max(Math.abs(dx), Math.abs(dy)) * .85, .23); break;
    case 'diamond': light = band((Math.abs(dx) + Math.abs(dy)) * .42, .14); break;
    case 'radar': light = band(angle, .12); break;
    case 'random': {
      const time = t * 8, frame = Math.floor(time), mix = smooth(time - frame);
      light = hash(index * 31 + frame * 101) * (1 - mix) + hash(index * 31 + ((frame + 1) % 8) * 101) * mix;
      break;
    }
    case 'checker': light = .5 + .5 * Math.cos(tau * t + (row + col) % 2 * Math.PI); break;
    case 'heartbeat': light = Math.max(band(.17, .045), .7 * band(.34, .05)); break;
    case 'breathing': light = .5 - .5 * Math.cos(tau * t); break;
    case 'pinwheel': light = Math.pow(.5 + .5 * Math.cos(tau * (t - angle * 2)), 2); break;
    default: light = .5 + .5 * Math.sin(tau * (t - direction * .6 - y * .08));
  }
  light = clamp(light);
  let opacity = .26 + .74 * light, scale = 1;
  if (settings.appearance === 'scale') scale = .65 + .35 * light;
  if (settings.appearance === 'lens') scale = .76 + .24 * light + .12 * (1 - radial);
  if (settings.appearance === 'shrink') scale = 1 - .25 * light;
  if (settings.appearance === 'pop') scale = .4 + .6 * smooth(light);
  if (settings.mask[index] === false) {
    const breath = .5 + .5 * Math.sin(tau * t + index * .35);
    opacity = { static: 1, dim: .18, breathe: .16 + breath * .26, ghost: .05 + breath * .12 }[settings.inactive] ?? .18;
    scale = 1;
    light = 0;
  }
  return { opacity, scale, light };
}

export function traceMotionShape(ctx, shape, size) {
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  else if (shape === 'rounded') ctx.roundRect(-size / 2, -size / 2, size, size, size * .12);
  else if (shape === 'square') ctx.rect(-size / 2, -size / 2, size, size);
  else {
    const count = shape === 'star' ? 10 : shape === 'hexagon' ? 6 : 4;
    for (let point = 0; point < count; point++) {
      const angle = -Math.PI / 2 + point * Math.PI * 2 / count;
      const radius = size / 2 * (shape === 'star' && point % 2 ? .48 : 1);
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      if (point) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
}

// Keep renderer dependencies in one serializable closure for minified builds.
export function createMotionRenderer(sample, trace) {
return function drawAvatarMotion(ctx, size, settings, colors, artwork, progress, editing = false, focusedIndex = -1) {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = settings.background === 'dark' ? '#121416' : '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const n = settings.grid, gap = settings.gap * size / 600;
  const cell = (size - gap * (n - 1)) / n;
  for (let index = 0; index < n * n; index++) {
    const row = Math.floor(index / n), col = index % n;
    const frame = editing ? { opacity: settings.mask[index] === false ? .12 : 1, scale: 1, light: 0 } : sample(settings, index, progress);
    ctx.save();
    ctx.translate(col * (cell + gap) + cell / 2, row * (cell + gap) + cell / 2);
    ctx.scale(frame.scale, frame.scale);
    ctx.globalAlpha = frame.opacity;
    trace(ctx, settings.shape, cell);
    ctx.fillStyle = colors[index];
    if (settings.glow && frame.light > .05) {
      ctx.shadowColor = colors[index];
      ctx.shadowBlur = settings.glowRange * size / 600 * frame.light;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    const image = artwork.get(colors[index]);
    if (image) {
      if (settings.layout === 'repeat') ctx.drawImage(image, -cell / 2, -cell / 2, cell, cell);
      else {
        const sourceSize = image.width / n;
        ctx.drawImage(image, col * sourceSize, row * sourceSize, sourceSize, sourceSize, -cell / 2, -cell / 2, cell, cell);
      }
    }
    ctx.restore();
  }
  if (editing && focusedIndex >= 0) {
    const row = Math.floor(focusedIndex / n), col = focusedIndex % n;
    ctx.save();
    ctx.translate(col * (cell + gap) + cell / 2, row * (cell + gap) + cell / 2);
    trace(ctx, settings.shape, cell - 4);
    ctx.lineWidth = Math.max(2, size / 300);
    ctx.strokeStyle = settings.background === 'dark' ? '#ffffff' : '#111111';
    ctx.stroke();
    ctx.restore();
  }
};
}
export const drawAvatarMotion = createMotionRenderer(sampleAvatarMotion, traceMotionShape);

export function motionHtml(settings, colors, cellImages) {
  const data = JSON.stringify({ settings, colors, images: cellImages }).replace(/</g, '\\u003c');
  // Export uses the exact preview sampler and geometry, with images embedded locally.
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tone Duo · Avatar motion</title><style>html,body{margin:0;min-height:100%;background:#fff}body{display:grid;place-items:center;min-height:100dvh}canvas{width:min(88vw,72vh,720px);aspect-ratio:1;cursor:pointer}button{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);border:1px solid #222;border-radius:30px;padding:10px 22px;background:white;font:14px system-ui}</style><canvas width="1200" height="1200" aria-label="Animated avatar grid"></canvas><button>Pause / Play</button><script>
const data=${data};
const sampleAvatarMotion=${sampleAvatarMotion.toString()};
const traceMotionShape=${traceMotionShape.toString()};
const drawAvatarMotion=(${createMotionRenderer.toString()})(sampleAvatarMotion,traceMotionShape);
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),artwork=new Map();
let playing=true,elapsed=0,last=0;
Promise.all(data.images.map(([color,url])=>new Promise(resolve=>{const image=new Image();image.onload=()=>{artwork.set(color,image);resolve()};image.src=url}))).then(()=>{requestAnimationFrame(frame)});
function frame(now){if(last&&playing)elapsed+=(now-last)/1000*data.settings.speed;last=now;drawAvatarMotion(ctx,1200,data.settings,data.colors,artwork,elapsed/3);requestAnimationFrame(frame)}
document.querySelector('button').onclick=()=>{playing=!playing};canvas.onclick=()=>{playing=!playing};
document.addEventListener('visibilitychange',()=>{last=0});
</script></html>`;
}
