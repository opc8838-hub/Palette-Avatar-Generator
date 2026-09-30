/** Avatar editor state and UI; device motion stays inside the independent viewer. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, Download, ImagePlus, RotateCcw, X, LoaderCircle, Play, Pause } from 'lucide-react';
import { useViewer } from './lib/use-viewer';
import palette from './palette.json';
import { BACK_TEXT_FONTS, loadDefaultPortrait, loadPortrait, prepareAvatarLayers, renderPreparedAvatar, renderPortraitScreens, downloadAvatar } from '../app/avatar-engine.js';

const steps = [
  { name: '选照片', title: ['还是你，', '多一种表达。'], copy: '从一张照片开始，找到属于你的色调。' },
  { name: '调颜色', title: ['你的颜色，', '你的样子。'], copy: '选择一种色系，让头像换一种气质。' },
  { name: '双面对比', title: ['同一个你，', '两种情绪。'], copy: '在展开屏幕中比较不同的人像呈现。' },
  { name: '保存头像', title: ['选好这一面。', '带走它。'], copy: '从屏幕里的预览，变成你的新头像。' },
];
function Preview({ image, label, className = '' }) {
  const ref = useRef(null);
  useEffect(() => { if (image && ref.current) { ref.current.width = image.width; ref.current.height = image.height; ref.current.getContext('2d').drawImage(image, 0, 0); } }, [image]);
  return <canvas ref={ref} className={className} role="img" aria-label={label} />;
}
function Range({ label, value, min, max, onChange, display, step = .01 }) {
  return <label className="range-row"><span>{label}<output>{display}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}
const TEXT_PRESETS = ['GOOD JOB', '做自己', '自在发光', 'JUST BE YOU', '今日份开心', '你好，世界', '保持热爱', 'COLOR YOUR DAY', '闪闪发光', '喜欢现在的自己', 'LIVE IN COLOR', '新的开始'];
function seriesColors(series) { return [...series.cards, ...(series.ramps || []).flatMap((ramp) => ramp.cards)]; }
const allColors = palette.series.flatMap(seriesColors);
function swatchInk(hex) {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return (r * .2126 + g * .7152 + b * .0722) < 145 ? '#fff' : '#343B34';
}
function ColorSwatch({ card, selected, onSelect, numbered = false }) {
  const active = selected === card.hex;
  return <button type="button" className={`swatch ${active ? 'selected' : ''}`} style={{ '--swatch': card.hex, '--swatch-ink': swatchInk(card.hex) }} aria-label={`${card.name} ${card.hex}`} aria-pressed={active} title={`${card.name} · ${card.hex}${card.reference ? ' · 参考原色' : ''}`} onClick={onSelect}>{active ? <Check size={16} color={swatchInk(card.hex)} strokeWidth={1.8} /> : numbered ? <span className="swatch-step">{String(card.level).padStart(2, '0')}</span> : null}{card.reference && <i className="reference-mark" />}</button>;
}
function DeviceFoldControl({ viewer }) {
  const fold = useViewer(viewer, 'fold');
  const ready = useViewer(viewer, 'ready');
  const degrees = Math.round((fold || 0) * 180);
  return <div className="device-control" role="group" aria-label="手机开合控制">
    <span className="device-control-label">手机开合</span>
    <button aria-label="合上手机" aria-pressed={degrees === 0} disabled={!ready} onClick={() => viewer.selectPose('closed')}>合上</button>
    <input type="range" aria-label="手机开合角度" min="0" max="180" step="1" value={degrees} disabled={!ready} onChange={(e) => viewer.setManualFold(Number(e.target.value) / 180)} />
    <button aria-label="展开手机" aria-pressed={degrees === 180} disabled={!ready} onClick={() => viewer.selectPose('landscape')}>展开</button>
    <output>{degrees}°</output>
    <button className="view-rotate" aria-label="旋转手机视角 45 度" disabled={!ready} onClick={viewer.rotateView}>旋转</button>
    <button className="view-reset" aria-label="恢复设备视角" onClick={viewer.resetView}><RotateCcw size={14} /></button>
  </div>;
}
export function App({ viewer }) {
  const ready = useViewer(viewer, 'ready'), viewerError = useViewer(viewer, 'error');
  const [step, setStep] = useState(0), [color, setColor] = useState('#F7BCDA'), [mode, setMode] = useState('original');
  const [seriesId, setSeriesId] = useState(palette.series[0].id);
  const [colorPlaying, setColorPlaying] = useState(false);
  const [colorInterval, setColorInterval] = useState(800);
  const [strength, setStrength] = useState(.32), [zoom, setZoom] = useState(1), [x, setX] = useState(0), [y, setY] = useState(0);
  const [source, setSource] = useState(null);
  const [busy, setBusy] = useState('准备默认人物…');
  const [error, setError] = useState(''), [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(''), [showCrop, setShowCrop] = useState(false), [showText, setShowText] = useState(false), [dragging, setDragging] = useState(false);
  const [textLayer, setTextLayer] = useState({ text: '', font: 'display', size: 128, x: 0, y: 0, color: '#111111' });
  const [fontRevision, setFontRevision] = useState(0);
  const input = useRef(null), request = useRef(0);
  const selected = allColors.find((card) => card.hex === color);
  const activeSeries = palette.series.find((series) => series.id === seriesId) || palette.series[0];
  const activeFamily = activeSeries.family;
  const options = useMemo(() => ({ color, mode, strength, zoom, x, y, textLayer }), [color, mode, strength, zoom, x, y, textLayer]);
  const activeSource = source;
  const avatarLayers = useMemo(() => activeSource ? prepareAvatarLayers(activeSource.canvas, { zoom, x, y }) : null, [activeSource, zoom, x, y]);
  const images = useMemo(() => avatarLayers ? { tint: renderPreparedAvatar(avatarLayers, { color, mode: 'tint', strength, size: 240, textLayer }), neutral: renderPreparedAvatar(avatarLayers, { color, mode: 'neutral', size: 240, textLayer }), original: renderPreparedAvatar(avatarLayers, { color, mode: 'original', size: 240, textLayer }) } : null, [avatarLayers, color, strength, textLayer, fontRevision]);
  const screenImages = useMemo(() => avatarLayers ? { tint: avatarLayers.neutral, neutral: avatarLayers.neutral, original: avatarLayers.original } : null, [avatarLayers]);
  function resetCrop() { setZoom(1); setX(0); setY(0); }
  async function prepareDefault() {
    const id = ++request.current; setBusy('准备默认人物…'); setError('');
    try { const result = await loadDefaultPortrait(); if (id === request.current) { setSource(result); resetCrop(); } }
    catch (e) { if (id === request.current) setError(e.message || '默认人物未能加载，请上传自己的照片。'); }
    finally { if (id === request.current) setBusy(''); }
  }
  async function upload(file) {
    if (!file) return;
    const id = ++request.current; setBusy('正在读取照片…'); setError('');
    try { const result = await loadPortrait(file, (message) => { if (id === request.current) setBusy(message); }); if (id === request.current) { setSource(result); setColorPlaying(false); resetCrop(); setStep(1); } }
    catch (e) { if (id === request.current) setError(e.message || '处理失败，请换一张清晰的照片重试。'); }
    finally { if (id === request.current) setBusy(''); }
  }
  useEffect(() => { prepareDefault(); return () => { request.current++; }; }, []);
  useEffect(() => {
    const font = BACK_TEXT_FONTS.find((item) => item.id === textLayer.font);
    if (!font) return;
    let active = true;
    document.fonts.load(`${font.weight} 128px ${font.family.split(',')[0]}`).then(() => { if (active) setFontRevision((revision) => revision + 1); }).catch(() => {});
    return () => { active = false; };
  }, [textLayer.font]);
  useEffect(() => { viewer.setBackground('#FFFFFF'); }, [viewer]);
  useEffect(() => { if (screenImages) { const secondary = mode === 'original' ? screenImages.original : screenImages.neutral; const screens = renderPortraitScreens(screenImages[mode], { compare: step === 2, secondary, textLayer }); viewer.setScreenCanvas(screens.inner, 'inner'); viewer.setScreenCanvas(screens.outer, 'outer'); } }, [screenImages, mode, step, textLayer, fontRevision, viewer]);
  useEffect(() => { viewer.setScreenAppearance({ color, mode, strength, compare: step === 2 }); }, [color, mode, strength, step, viewer]);
  useEffect(() => {
    if (!colorPlaying || !source) return;
    const colors = activeSeries.cards;
    if (colors.length < 2) return;
    const timer = window.setInterval(() => {
      setColor((current) => {
        const index = colors.findIndex((card) => card.hex === current);
        return colors[(index + 1 + colors.length) % colors.length].hex;
      });
    }, colorInterval);
    return () => window.clearInterval(timer);
  }, [colorPlaying, colorInterval, source, activeSeries]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  async function save() {
    if (!activeSource || exporting || busy) return;
    setExporting(true); setError('');
    try { await downloadAvatar(activeSource.canvas, options); setToast('头像已准备好，请查看浏览器下载。'); }
    catch (e) { setError(e.message); } finally { setExporting(false); }
  }
  return <>
    <header className="studio-header"><a className="wordmark" href="#" onClick={(e) => { e.preventDefault(); setStep(0); }} aria-label="Tone Duo 首页">tone<span className="brand-slash">/</span>duo<i /></a><button className="header-save" onClick={() => setStep(3)}>我的头像 <ArrowUpRight size={16} /></button></header>
    <section className="stage-copy" aria-live="polite" key={step}><p className="eyebrow"><i /> A PORTRAIT, TWO EXPRESSIONS</p><h1>{steps[step].title[0]}<br />{steps[step].title[1]}</h1><p className="stage-description">{steps[step].copy}</p></section>
    {!ready && !viewerError && <div className="viewer-loading" role="status"><LoaderCircle className="spin" size={17} /> 正在展开你的工作室…</div>}
    {viewerError && <div className="flat-fallback"><Preview image={images?.[mode]} label="平面头像预览" /><p>设备预览暂不可用，仍可编辑和下载头像。</p></div>}
    <div className="stage-bottom"><DeviceFoldControl viewer={viewer} /><nav className="steps" aria-label="头像制作步骤">{steps.map((s, i) => <button key={s.name} aria-current={step === i ? 'step' : undefined} className={step === i ? 'active' : ''} onClick={() => setStep(i)}>{s.name}{step === i && <i />}</button>)}</nav></div>
    <div className={`editor-wrap ${showCrop || showText ? 'is-expanded' : ''}`}>
    <aside className={`editor ${dragging ? 'dragging' : ''}`} aria-label="头像编辑器" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }} onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files[0]); }}>
      <div className="editor-top"><span>你的头像工作室</span><span className="edition">NO. 001</span></div>
      <div className="editor-scroll">
        <section><div className="section-heading"><span className="section-label">照片</span><button className="text-button" onClick={() => setShowCrop((v) => !v)} aria-expanded={showCrop}>{showCrop ? '收起调整' : '调整构图'} <ArrowUpRight size={12} /></button></div>
          <div className="photo-row"><div className="portrait-frame"><Preview image={images?.[mode]} label="当前头像预览" />{busy && <div className="portrait-busy"><LoaderCircle size={22} className="spin" /></div>}</div><div className="photo-actions"><button className="upload-button" onClick={() => input.current.click()} disabled={Boolean(busy)}><ImagePlus size={15} /> 上传你的照片</button><p>也可拖入一张照片<br />JPG / PNG / WebP · 25 MB 内</p></div></div>
          <input className="sr-only" type="file" ref={input} accept="image/png,image/jpeg,image/webp,image/avif" aria-label="上传照片文件" onChange={(e) => { upload(e.target.files[0]); e.target.value = ''; }} />
          <p className="photo-status" role="status">{busy || (source?.name === '默认人物.png' ? '当前为默认人物；可上传自己的照片。' : source?.name || '选择一张清晰的正面照片。')}</p>
          {showCrop && <div className="crop-controls"><Range label="人像大小" value={zoom} min={.65} max={2} onChange={setZoom} display={`${Math.round(zoom * 100)}%`} /><Range label="左右位置" value={x} min={-.5} max={.5} onChange={setX} display={Math.round(x * 100)} /><Range label="上下位置" value={y} min={-.5} max={.5} onChange={setY} display={Math.round(y * 100)} /><button className="text-button" onClick={resetCrop}>重置构图 <RotateCcw size={12} /></button></div>}
        </section>
        <section className="back-text-section"><button type="button" className="back-text-toggle" aria-expanded={showText} onClick={() => setShowText((open) => !open)}><span>头像背后文字</span><span>{showText ? '收起' : '展开'} <ArrowUpRight size={14} /></span></button>
          {showText && <div className="back-text-content">
            <p className="back-text-help">文字放在人像后方，可输入自己的内容。</p>
            <label className="back-text-field">文字内容<textarea aria-label="头像背后文字内容" value={textLayer.text} rows={2} maxLength={120} placeholder="输入中文或 English，可换行" onChange={(e) => setTextLayer((layer) => ({ ...layer, text: e.target.value }))} /></label>
            <label className="back-text-field back-text-preset">示例文字<select aria-label="选择示例文字" value="" onChange={(e) => { if (e.target.value) setTextLayer((layer) => ({ ...layer, text: e.target.value })); }}><option value="">选择一句文字…</option>{TEXT_PRESETS.map((phrase) => <option key={phrase} value={phrase}>{phrase}</option>)}</select></label>
            <div className="back-text-options"><label>字体<select aria-label="头像背后文字字体" value={textLayer.font} onChange={(e) => setTextLayer((layer) => ({ ...layer, font: e.target.value }))}>{BACK_TEXT_FONTS.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}</select></label><label>文字颜色<input type="color" aria-label="头像背后文字颜色" value={textLayer.color} onChange={(e) => setTextLayer((layer) => ({ ...layer, color: e.target.value }))} /></label></div>
            <Range label="文字大小" value={textLayer.size} min={24} max={320} step={1} display={`${textLayer.size} px`} onChange={(value) => setTextLayer((layer) => ({ ...layer, size: value }))} />
            <Range label="左右位置" value={textLayer.x} min={-.4} max={.4} display={`${Math.round(textLayer.x * 100)}%`} onChange={(value) => setTextLayer((layer) => ({ ...layer, x: value }))} />
            <Range label="上下位置" value={textLayer.y} min={-.4} max={.4} display={`${Math.round(textLayer.y * 100)}%`} onChange={(value) => setTextLayer((layer) => ({ ...layer, y: value }))} />
          </div>}
        </section>
        <section className="mode-section"><div className="section-heading"><span className="section-label">人像模式</span><span className="section-hint">点击切换人像效果</span></div>
          <div className="mode-options" role="group" aria-label="人像模式">{[{ id: 'tint', title: '同色微染' }, { id: 'neutral', title: '中性黑白' }, { id: 'original', title: '保留原色' }].map((m) => <button key={m.id} className={`mode-card ${mode === m.id ? 'selected' : ''}`} onClick={() => setMode(m.id)} aria-pressed={mode === m.id}><Preview image={images?.[m.id]} label={`${m.title}示例`} /><span className="mode-copy"><span className="mode-title">{m.title}</span></span><i className="mode-check">{mode === m.id && <Check size={11} />}</i></button>)}</div>
          {mode === 'tint' && <Range label="染色程度" value={strength} min={.1} max={.8} onChange={setStrength} display={strength < .4 ? '轻柔' : strength < .6 ? '适中' : '明显'} />}
        </section>
        <section className="color-section"><div className="section-heading"><span className="section-label">背景颜色</span><div className="color-heading-actions"><span className="color-value">{selected?.name} <code>{color}</code></span><button type="button" className={`color-play-button ${colorPlaying ? 'is-playing' : ''}`} style={{ '--cycle-duration': `${colorInterval}ms` }} aria-label={colorPlaying ? '暂停自动换色' : '播放自动换色'} aria-pressed={colorPlaying} title={colorPlaying ? '暂停自动换色' : '播放自动换色'} disabled={!source} onClick={() => setColorPlaying((playing) => !playing)}>{colorPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button></div></div>
          <label className="color-speed-control"><span>换色速度</span><input type="range" aria-label="自动换色速度" aria-valuetext={`${(colorInterval / 1000).toFixed(1)} 秒/色`} min="400" max="2400" step="100" value={colorInterval} onChange={(event) => setColorInterval(Number(event.target.value))} /><output>{(colorInterval / 1000).toFixed(1)} 秒/色</output></label>
          <div className="family-tabs" role="group" aria-label="色系分类">{palette.families.map((family) => <button key={family.id} type="button" aria-pressed={activeFamily === family.id} onClick={() => { const first = palette.series.find((series) => series.family === family.id); setSeriesId(first.id); setColor(first.cards[0].hex); }}>{family.name}</button>)}</div>
          <div className="series-list" role="group" aria-label="选择色系">{palette.series.filter((series) => series.family === activeFamily).map((series) => <button key={series.id} type="button" className={`series-tab ${seriesId === series.id ? 'active' : ''}`} aria-pressed={seriesId === series.id} onClick={() => { setSeriesId(series.id); setColor(series.cards[0].hex); }}><i style={{ '--series-accent': series.accent }} /><span>{series.name}</span><small>{seriesColors(series).length}</small></button>)}</div>
          <div className="series-panel" key={activeSeries.id}>
            <div className="series-meta"><span>{activeSeries.subtitle}</span><span>{activeSeries.source}</span></div>
            <div className="swatches">{activeSeries.cards.map((card) => <ColorSwatch key={card.id} card={card} selected={color} onSelect={() => setColor(card.hex)} />)}</div>
          </div>
          <p className="palette-note"><i /> {palette.series.length} 个色系 · {allColors.length} 款颜色</p>
        </section>
        {error && <div className="error-message" role="alert"><span>{error}</span><button aria-label="关闭提示" onClick={() => setError('')}><X size={15} /></button></div>}
      </div>
      <div className="editor-footer"><button className="download-button" onClick={save} disabled={!activeSource || Boolean(busy) || exporting}>{exporting ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />} {exporting ? '正在保存…' : '下载头像'} <span>PNG ↗</span></button><p><i /> {step === 3 ? "方形 PNG · 1024 × 1024 px" : "照片仅在本机处理"}</p></div>
    </aside>
    </div>
    <footer className="site-footer"><span>TONE DUO — A LITTLE COLOR, A LITTLE YOU.</span><a href="https://github.com/bravohenry/iphone-duo-motion-study" target="_blank" rel="noreferrer">Duo motion study <ArrowUpRight size={11} /></a></footer>
    {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
  </>;
}
