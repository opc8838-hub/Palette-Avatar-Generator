/** Live avatar motion artboard and controls; animation frames stay outside React. */
import { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Download, Pause, Play, RotateCcw, Shuffle, Pencil, Sparkles } from 'lucide-react';
import { prepareAvatarLayers, renderPreparedAvatar } from '../app/avatar-engine.js';
import { drawAvatarMotion, motionColors, motionHtml, MOTION_PRESETS, resizeMotionMask } from '../app/avatar-motion.js';

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function artworkCache(layers, colors, options, size) {
  const prepared = prepareAvatarLayers(layers.original, { size });
  return new Map([...new Set(colors)].map((color) => [color, renderPreparedAvatar(prepared, { ...options, color, size })]));
}

export function MotionPreview({ layers, color, series, allColors, options, settings, onSettings, playing, onPlaying, editing, onEditing, controlsRef, t }) {
  const canvasRef = useRef(null), seekRef = useRef(null), counterRef = useRef(null);
  const clock = useRef({ elapsed: 0, last: 0 }), brush = useRef(null), focusedCell = useRef(0);
  const seriesHex = useMemo(() => series.map((card) => card.hex), [series]);
  const allHex = useMemo(() => allColors.map((card) => card.hex), [allColors]);
  const colors = useMemo(() => motionColors(settings, color, seriesHex, allHex), [settings.grid, settings.seed, settings.colorMode, color, seriesHex, allHex]);
  const prepared = useMemo(() => layers ? prepareAvatarLayers(layers.original, { size: 512 }) : null, [layers]);
  const cachedArtwork = useMemo(() => new Map(), [prepared, options.mode, options.strength, options.textLayer, options.fontRevision]);
  const artwork = useMemo(() => {
    if (prepared) for (const hex of new Set(colors)) {
      if (!cachedArtwork.has(hex)) cachedArtwork.set(hex, renderPreparedAvatar(prepared, { ...options, color: hex, size: 512 }));
    }
    return cachedArtwork;
  }, [prepared, colors, cachedArtwork]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const observer = new ResizeObserver(() => {
      const size = Math.max(1, Math.min(1200, Math.round(canvas.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, 2))));
      if (canvas.width !== size) {
        canvas.width = canvas.height = size;
        drawAvatarMotion(canvas.getContext('2d'), size, settings, colors, artwork, clock.current.elapsed / 3, editing, focusedCell.current);
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [settings, colors, artwork, editing]);
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas.getContext('2d');
    let frame;
    const draw = (now) => {
      const state = clock.current;
      if (state.last && playing && !editing && !document.hidden) state.elapsed += Math.min((now - state.last) / 1000, .1) * settings.speed;
      state.last = now;
      const progress = state.elapsed / 3;
      drawAvatarMotion(ctx, canvas.width, settings, colors, artwork, progress, editing, focusedCell.current);
      const phase = (progress % 1 + 1) % 1;
      seekRef.current.value = String(Math.round(phase * 1000));
      counterRef.current.textContent = `${Math.round(phase * 100)}%`;
      if (playing && !editing) frame = requestAnimationFrame(draw);
    };
    clock.current.last = 0;
    draw(performance.now());
    const visibility = () => { clock.current.last = 0; };
    document.addEventListener('visibilitychange', visibility);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility); };
  }, [artwork, colors, settings, playing, editing]);

  useImperativeHandle(controlsRef, () => ({
    async savePNG() {
      if (!layers) return;
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1200;
      const highRes = artworkCache(layers, colors, options, 1024);
      drawAvatarMotion(canvas.getContext('2d'), 1200, settings, colors, highRes, clock.current.elapsed / 3, editing);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error(t('画面导出失败，请重试。'));
      downloadBlob(blob, 'tone-duo-motion.png');
    },
    saveHTML() {
      if (!layers) return;
      const assets = [...new Set(colors)].map((hex) => [hex, artwork.get(hex).toDataURL('image/png')]);
      downloadBlob(new Blob([motionHtml(settings, colors, assets)], { type: 'text/html;charset=utf-8' }), 'tone-duo-motion.html');
    },
  }), [layers, artwork, colors, settings, options, editing, t]);

  function seek(event) {
    onPlaying(false);
    clock.current.elapsed = Number(event.target.value) / 1000 * 3;
    drawAvatarMotion(canvasRef.current.getContext('2d'), canvasRef.current.width, settings, colors, artwork, clock.current.elapsed / 3, editing);
    counterRef.current.textContent = `${Math.round(Number(event.target.value) / 10)}%`;
  }
  function hit(event) {
    const rect = canvasRef.current.getBoundingClientRect(), n = settings.grid;
    const x = Math.min(.999999, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(.999999, Math.max(0, (event.clientY - rect.top) / rect.height));
    return Math.floor(y * n) * n + Math.floor(x * n);
  }
  function paint(index, active) { onSettings((current) => ({ ...current, mask: current.mask.map((value, cell) => cell === index ? active : value) })); }
  return <section className="avatar-motion-preview" aria-label={t('头像动效预览')}>
    <div className="motion-heading"><div><span className="social-preview-kicker">AVATAR IN MOTION</span><h2>{t('让你的颜色，一起亮起来。')}</h2></div><span className="motion-grid-badge">{settings.grid} × {settings.grid}</span></div>
    <div className={`motion-artboard ${settings.background === 'dark' ? 'is-dark' : ''} ${editing ? 'is-editing' : ''}`}>
      <canvas ref={canvasRef} width="1200" height="1200" tabIndex={0} role="img" aria-label={t(editing ? '编辑格子：方向键移动，空格切换' : '头像动效画布')}
        onPointerDown={(event) => {
          if (!editing) return;
          event.preventDefault(); event.currentTarget.focus();
          const index = hit(event), active = settings.mask[index] === false;
          focusedCell.current = index; brush.current = { pointerId: event.pointerId, active };
          event.currentTarget.setPointerCapture(event.pointerId); paint(index, active);
        }}
        onPointerMove={(event) => { if (brush.current?.pointerId === event.pointerId) paint(hit(event), brush.current.active); }}
        onPointerUp={() => { brush.current = null; }} onPointerCancel={() => { brush.current = null; }} onLostPointerCapture={() => { brush.current = null; }}
        onKeyDown={(event) => {
          if (!editing) return;
          const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -settings.grid, ArrowDown: settings.grid }[event.key];
          if (delta) {
            event.preventDefault(); focusedCell.current = Math.max(0, Math.min(settings.grid ** 2 - 1, focusedCell.current + delta));
            drawAvatarMotion(event.currentTarget.getContext('2d'), event.currentTarget.width, settings, colors, artwork, clock.current.elapsed / 3, true, focusedCell.current);
          }
          else if (event.key === ' ') { event.preventDefault(); paint(focusedCell.current, settings.mask[focusedCell.current] === false); }
        }} />
      {!layers && <span className="motion-empty">{t('准备默认人物…')}</span>}
    </div>
    <div className="motion-transport">
      <button type="button" className={playing && !editing ? 'is-playing' : ''} aria-label={t(playing && !editing ? '暂停动效' : '播放动效')} onClick={() => { onEditing(false); onPlaying(!playing || editing); }}>{playing && !editing ? <Pause size={16} /> : <Play size={16} />}<span>{t(playing && !editing ? '暂停' : '播放')}</span></button>
      <button type="button" aria-label={t('重播动效')} title={t('重播动效')} onClick={() => { clock.current.elapsed = 0; onEditing(false); onPlaying(true); }}><RotateCcw size={15} /></button>
      <input ref={seekRef} type="range" min="0" max="1000" defaultValue="0" aria-label={t('动效进度')} onChange={seek} />
      <output ref={counterRef}>0%</output>
      <button type="button" aria-pressed={editing} onClick={() => { onEditing(!editing); onPlaying(false); }}><Pencil size={15} /><span>{t('编辑格子')}</span></button>
    </div>
    <p className="motion-artboard-help">{t(editing ? '点击或拖动格子，决定哪些格子亮起。' : '当前头像、人像模式和文字会同步到动效。')}</p>
  </section>;
}

function MotionRange({ label, value, min, max, step = 1, suffix = '', onChange }) {
  return <label className="range-row"><span>{label}<output>{value}{suffix}</output></span><input type="range" aria-label={label} value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
function Choices({ label, value, choices, onChange, t }) {
  return <div className="motion-choice-group"><span className="motion-control-label">{t(label)}</span><div role="group" aria-label={t(label)}>{choices.map(([id, name]) => <button type="button" key={id} aria-pressed={value === id} onClick={() => onChange(id)}>{t(name)}</button>)}</div></div>;
}

export function MotionControls({ settings, onSettings, onPlaying, onEditing, controlsRef, t }) {
  const update = (key, value) => onSettings((current) => ({ ...current, [key]: value }));
  const origin = ['burst', 'bloom', 'diamond', 'radar', 'pinwheel'].includes(settings.preset);
  const direction = ['wave', 'sweep', 'lens'].includes(settings.preset);
  return <div className="motion-controls">
    <section>
      <div className="section-heading"><span>{t('动效编辑')}</span><Sparkles size={15} /></div>
      <Choices label="头像排列" value={settings.layout} choices={[["mosaic", '拼成一张'], ['repeat', '每格头像']]} onChange={(value) => update('layout', value)} t={t} />
      <MotionRange label={t('格子数量')} value={settings.grid} min={3} max={13} suffix={` × ${settings.grid}`} onChange={(value) => onSettings((current) => ({ ...current, grid: value, mask: resizeMotionMask(current.mask, current.grid, value) }))} />
      <MotionRange label={t('格子间距')} value={settings.gap} min={0} max={20} suffix=" px" onChange={(value) => update('gap', value)} />
      <label className="motion-select">{t('格子形状')}<select aria-label={t('格子形状')} value={settings.shape} onChange={(event) => update('shape', event.target.value)}>{[['rounded', '圆角'], ['square', '方形'], ['circle', '圆形'], ['diamond', '菱形'], ['hexagon', '六边形'], ['star', '星形']].map(([id, name]) => <option key={id} value={id}>{t(name)}</option>)}</select></label>
    </section>
    <section>
      <Choices label="格子配色" value={settings.colorMode} choices={[["uniform", '统一颜色'], ['series', '系列随机'], ['all', '全部随机']]} onChange={(value) => update('colorMode', value)} t={t} />
      <button type="button" className="motion-secondary-button" disabled={settings.colorMode === 'uniform'} onClick={() => update('seed', settings.seed + 1)}><Shuffle size={14} />{t('重新随机配色')}</button>
      <p className="motion-control-help">{t('统一颜色跟随背景色；随机配色从色库中选取。')}</p>
    </section>
    <section>
      <label className="motion-select">{t('动效预设')}<select aria-label={t('动效预设')} value={settings.preset} onChange={(event) => update('preset', event.target.value)}>{MOTION_PRESETS.map(([id, name]) => <option key={id} value={id}>{t(name)}</option>)}</select></label>
      <MotionRange label={t('播放速度')} value={settings.speed} min={.25} max={3} step={.05} suffix="×" onChange={(value) => update('speed', value)} />
      <label className="motion-select">{t('亮起方式')}<select aria-label={t('亮起方式')} value={settings.appearance} onChange={(event) => update('appearance', event.target.value)}>{[['opacity', '明暗变化'], ['scale', '明暗与缩放'], ['lens', '鱼眼缩放'], ['shrink', '亮起时收缩'], ['pop', '弹出']].map(([id, name]) => <option key={id} value={id}>{t(name)}</option>)}</select></label>
      {direction && <label className="motion-select">{t('动效方向')}<select aria-label={t('动效方向')} value={settings.direction} onChange={(event) => update('direction', event.target.value)}>{[['right', '向右'], ['left', '向左'], ['down', '向下'], ['up', '向上'], ['diagonal', '斜向']].map(([id, name]) => <option key={id} value={id}>{t(name)}</option>)}</select></label>}
      {origin && <><MotionRange label={t('起点左右')} value={Math.round(settings.originX * 100)} min={0} max={100} suffix="%" onChange={(value) => update('originX', value / 100)} /><MotionRange label={t('起点上下')} value={Math.round(settings.originY * 100)} min={0} max={100} suffix="%" onChange={(value) => update('originY', value / 100)} /></>}
    </section>
    <section>
      <div className="motion-switch-row"><span>{t('颜色发光')}</span><button type="button" className="motion-switch" role="switch" aria-checked={settings.glow} aria-label={t('颜色发光')} onClick={() => update('glow', !settings.glow)}><i /></button></div>
      {settings.glow && <MotionRange label={t('发光范围')} value={settings.glowRange} min={0} max={24} suffix=" px" onChange={(value) => update('glowRange', value)} />}
      <Choices label="画布底色" value={settings.background || 'light'} choices={[["light", '浅色'], ['dark', '深色']]} onChange={(value) => update('background', value)} t={t} />
      <label className="motion-select">{t('未亮格子')}<select aria-label={t('未亮格子')} value={settings.inactive} onChange={(event) => update('inactive', event.target.value)}>{[['static', '保持原样'], ['dim', '静态变暗'], ['breathe', '轻微呼吸'], ['ghost', '淡淡轮廓']].map(([id, name]) => <option key={id} value={id}>{t(name)}</option>)}</select></label>
      <div className="motion-mask-actions"><button type="button" onClick={() => { update('mask', Array(settings.grid ** 2).fill(true)); }}>{t('全部亮起')}</button><button type="button" onClick={() => { update('mask', Array(settings.grid ** 2).fill(false)); onEditing(true); onPlaying(false); }}>{t('清空格子')}</button></div>
    </section>
    <section>
      <button type="button" className="motion-secondary-button" onClick={() => controlsRef.current?.saveHTML()}><Download size={14} />{t('下载动效 HTML')}</button>
      <p className="motion-control-help">{t('保存后可直接打开播放，头像和动效都在文件里。')}</p>
    </section>
  </div>;
}
