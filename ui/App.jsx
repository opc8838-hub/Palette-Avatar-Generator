/** Avatar editor, social previews, and draggable panel; device motion stays in the viewer. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, Download, Grip, ImagePlus, RotateCcw, X, LoaderCircle, Play, Pause, Sparkles, Sun, Moon } from 'lucide-react';
import { useViewer } from './lib/use-viewer';
import { SocialPreview } from './SocialPreview.jsx';
import { MotionPreview, MotionControls } from './MotionPreview.jsx';
import { MOTION_DEFAULTS } from '../app/avatar-motion.js';
import { useStudioTheme } from './useStudioTheme.js';
import { textPresets, translate } from './i18n.js';
import palette from './palette.json';
import { IllustrationControls } from './IllustrationControls.jsx';
import { loadIllustrations, composeIllustration } from '../app/illustration-engine.js';
import { BACK_TEXT_FONTS, loadDefaultPortrait, loadPortrait, prepareAvatarLayers, renderPreparedAvatar, renderPortraitScreens, renderTintedPortrait, downloadAvatar } from '../app/avatar-engine.js';

const steps = [
  { name: '选照片', title: ['还是你，', '多一种表达。'], copy: '从一张照片开始，找到属于你的色调。' },
  { name: '调颜色', title: ['你的颜色，', '你的样子。'], copy: '选择一种色系，让头像换一种气质。' },
  { name: '社媒对比', title: ['同一张头像，', '四种社媒呈现。'], copy: '看看当前头像出现在不同账号主页中的效果。' },
  { name: '保存头像', title: ['选好这一面。', '带走它。'], copy: '从屏幕里的预览，变成你的新头像。' },
  { name: '动效预览', title: ['让你的颜色，', '一起亮起来。'], copy: '将当前头像变成可编辑的格子动效。' },
];
function Preview({ image, label, className = '' }) {
  const ref = useRef(null);
  useEffect(() => { if (image && ref.current) { ref.current.width = image.width; ref.current.height = image.height; ref.current.getContext('2d').drawImage(image, 0, 0); } }, [image]);
  return <canvas ref={ref} className={className} role="img" aria-label={label} />;
}
function Range({ label, value, min, max, onChange, display, step = .01 }) {
  return <label className="range-row"><span>{label}<output>{display}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}
function seriesColors(series) { return [...series.cards, ...(series.ramps || []).flatMap((ramp) => ramp.cards)]; }
const allColors = palette.series.flatMap(seriesColors);
const initialView = new URLSearchParams(window.location.search);
const initialIllustrationStyle = ['line', 'solid', 'color'].includes(initialView.get('style')) ? initialView.get('style') : null;
function swatchInk(hex) {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return (r * .2126 + g * .7152 + b * .0722) < 145 ? '#fff' : '#343B34';
}
function ColorSwatch({ card, selected, onSelect, t, numbered = false }) {
  const active = selected === card.hex;
  return <button type="button" className={`swatch ${active ? 'selected' : ''}`} style={{ '--swatch': card.hex, '--swatch-ink': swatchInk(card.hex) }} aria-label={`${t(card.name)} ${card.hex}`} aria-pressed={active} title={`${t(card.name)} · ${card.hex}${card.reference ? ` · ${t('参考原色')}` : ''}`} onClick={onSelect}>{active ? <Check size={16} color={swatchInk(card.hex)} strokeWidth={1.8} /> : numbered ? <span className="swatch-step">{String(card.level).padStart(2, '0')}</span> : null}{card.reference && <i className="reference-mark" />}</button>;
}
function DeviceFoldControl({ viewer, t }) {
  const fold = useViewer(viewer, 'fold');
  const ready = useViewer(viewer, 'ready');
  const degrees = Math.round((fold || 0) * 180);
  return <div className="device-control" role="group" aria-label={t('手机开合控制')}>
    <span className="device-control-label">{t('手机开合')}</span>
    <button aria-label={t('合上手机')} aria-pressed={degrees === 0} disabled={!ready} onClick={() => viewer.selectPose('closed')}>{t('合上')}</button>
    <input type="range" aria-label={t('手机开合角度')} min="0" max="180" step="1" value={degrees} disabled={!ready} onChange={(e) => viewer.setManualFold(Number(e.target.value) / 180)} />
    <button aria-label={t('展开手机')} aria-pressed={degrees === 180} disabled={!ready} onClick={() => viewer.selectPose('landscape')}>{t('展开')}</button>
    <output>{degrees}°</output>
    <button className="view-rotate" aria-label={t('旋转手机视角 45 度')} disabled={!ready} onClick={viewer.rotateView}>{t('旋转')}</button>
    <button className="view-reset" aria-label={t('恢复设备视角')} onClick={viewer.resetView}><RotateCcw size={14} /></button>
  </div>;
}
export function App({ viewer }) {
  const { theme, toggleTheme } = useStudioTheme();
  const [language, setLanguage] = useState(() => { try { return localStorage.getItem('tone-duo-language') === 'en' ? 'en' : 'zh'; } catch { return 'zh'; } });
  const [languagePhase, setLanguagePhase] = useState('idle');
  const languageTimer = useRef(null);
  const t = (text) => translate(language, text);
  const ready = useViewer(viewer, 'ready'), viewerError = useViewer(viewer, 'error');
  const [step, setStep] = useState(initialView.get('view') === 'social' ? 2 : 0), [color, setColor] = useState('#F7BCDA'), [mode, setMode] = useState('original');
  const [seriesId, setSeriesId] = useState(palette.series[0].id);
  const [colorPlaying, setColorPlaying] = useState(false);
  const [colorInterval, setColorInterval] = useState(800);
  const [strength, setStrength] = useState(.32), [zoom, setZoom] = useState(1), [x, setX] = useState(0), [y, setY] = useState(0);
  const [source, setSource] = useState(null);
  const [portraitFamily, setPortraitFamily] = useState(initialIllustrationStyle ? 'illustration' : 'photo');
  const [illustrationStyle, setIllustrationStyle] = useState(initialIllustrationStyle || 'color');
  const [illustrationSubject, setIllustrationSubject] = useState(initialView.get('sample') === 'woman' ? 'woman' : 'male');
  const [illustrations, setIllustrations] = useState(null);
  const [illustrationBusy, setIllustrationBusy] = useState(false);
  const [illustrationError, setIllustrationError] = useState('');
  const [illustrationMaterials, setIllustrationMaterials] = useState({ male: {}, woman: {} });
  const [makeup, setMakeup] = useState({ blush: { on: true, color: '#e53935', strength: 20 }, lips: { on: true, color: '#e53935', strength: 35 } });
  const isIllustration = portraitFamily === 'illustration';
  const effectiveMode = isIllustration ? 'original' : mode;
  const effectiveColor = isIllustration && illustrationStyle !== 'color' ? '#FFFFFF' : color;
  const [busy, setBusy] = useState('准备默认人物…');
  const activeBusy = isIllustration ? illustrationBusy : Boolean(busy);
  const [error, setError] = useState(''), [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(''), [showCrop, setShowCrop] = useState(false), [showText, setShowText] = useState(false), [dragging, setDragging] = useState(false);
  const [textLayer, setTextLayer] = useState({ text: '', font: 'display', size: 128, x: 0, y: 0, color: '#111111' });
  const [fontRevision, setFontRevision] = useState(0);
  const [motionSettings, setMotionSettings] = useState(() => ({ ...MOTION_DEFAULTS, mask: [...MOTION_DEFAULTS.mask] }));
  const [motionPlaying, setMotionPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [motionEditing, setMotionEditing] = useState(false);
  const motionControls = useRef(null);
  const input = useRef(null), request = useRef(0);
  const editorRef = useRef(null), editorOffset = useRef({ x: 0, y: 0 }), activeEditorDrag = useRef(null);
  const selected = allColors.find((card) => card.hex === color);
  useEffect(() => {
    document.getElementById('stage')?.setAttribute('data-language-phase', languagePhase);
  }, [languagePhase]);
  useEffect(() => () => window.clearTimeout(languageTimer.current), []);
  function toggleLanguage() {
    if (languageTimer.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setLanguage((current) => current === 'zh' ? 'en' : 'zh'); return; }
    setLanguagePhase('out');
    languageTimer.current = window.setTimeout(() => {
      setLanguage((current) => current === 'zh' ? 'en' : 'zh');
      setLanguagePhase('in');
      languageTimer.current = window.setTimeout(() => { setLanguagePhase('idle'); languageTimer.current = null; }, 280);
    }, 160);
  }
  useEffect(() => {
    const english = language === 'en';
    document.documentElement.lang = english ? 'en' : 'zh-CN';
    document.title = english ? 'Tone Duo · Avatar Studio' : 'Tone Duo · 头像工作室';
    document.querySelector('meta[name="description"]')?.setAttribute('content', english ? 'Create a colorful avatar and preview it across four social profiles.' : '上传照片，制作彩色头像，并在四种社媒主页中预览。');
    document.querySelector('#stage')?.setAttribute('aria-label', english ? 'Tone Duo avatar studio' : 'Tone Duo 头像工作室');
    document.querySelector('#webgl')?.setAttribute('aria-label', english ? 'Rotatable foldable phone avatar preview' : '可旋转折叠的头像预览设备');
    try { localStorage.setItem('tone-duo-language', language); } catch {}
  }, [language]);
  const activeSeries = palette.series.find((series) => series.id === seriesId) || palette.series[0];
  const activeFamily = activeSeries.family;
  const motionSeries = useMemo(() => seriesColors(activeSeries), [activeSeries]);
  const options = useMemo(() => ({ color: effectiveColor, mode: effectiveMode, style: isIllustration ? illustrationStyle : null, strength, zoom, x, y, textLayer }), [effectiveColor, effectiveMode, isIllustration, illustrationStyle, strength, zoom, x, y, textLayer]);
  const illustrationSource = useMemo(() => composeIllustration(illustrations, { subject: illustrationSubject, style: illustrationStyle, materials: illustrationMaterials[illustrationSubject], ...makeup }), [illustrations, illustrationSubject, illustrationStyle, illustrationMaterials, makeup]);
  const activeSource = isIllustration ? illustrationSource : source;
  const avatarLayers = useMemo(() => activeSource ? prepareAvatarLayers(activeSource.canvas, { zoom, x, y }) : null, [activeSource, zoom, x, y]);
  const photoImages = useMemo(() => avatarLayers ? { tint: renderPreparedAvatar(avatarLayers, { color, mode: 'tint', strength, size: 240, textLayer }), neutral: renderPreparedAvatar(avatarLayers, { color, mode: 'neutral', size: 240, textLayer }), original: renderPreparedAvatar(avatarLayers, { color, mode: 'original', size: 240, textLayer }) } : null, [avatarLayers, color, strength, textLayer, fontRevision]);
  const illustrationImages = useMemo(() => {
    if (!illustrations) return null;
    return Object.fromEntries(['line', 'solid', 'color'].map(style => {
      const sample = composeIllustration(illustrations, { subject: illustrationSubject, style, materials: illustrationMaterials[illustrationSubject], ...makeup });
      const layers = prepareAvatarLayers(sample.canvas, { zoom, x, y });
      return [style, renderPreparedAvatar(layers, { color: style === 'color' ? color : '#FFFFFF', mode: 'original', size: 240, textLayer })];
    }));
  }, [illustrations, illustrationSubject, illustrationMaterials, makeup, zoom, x, y, color, textLayer, fontRevision]);
  const images = isIllustration ? illustrationImages : photoImages;
  const currentImage = images?.[isIllustration ? illustrationStyle : mode];
  const tintedScreenPortrait = useMemo(() => avatarLayers && mode === 'tint' ? renderTintedPortrait(avatarLayers, color, strength) : null, [avatarLayers, color, strength, mode]);
  const screenPortrait = isIllustration ? avatarLayers?.original : mode === 'tint' ? tintedScreenPortrait : mode === 'original' ? avatarLayers?.original : avatarLayers?.neutral;
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
    try { const result = await loadPortrait(file, (message) => { if (id === request.current) setBusy(message); }); if (id === request.current) { setSource(result); setPortraitFamily('photo'); setColorPlaying(false); resetCrop(); setStep((current) => current === 4 ? 4 : 1); } }
    catch (e) { if (id === request.current) setError(e.message || '处理失败，请换一张清晰的照片重试。'); }
    finally { if (id === request.current) setBusy(''); }
  }
  useEffect(() => { prepareDefault(); return () => { request.current++; }; }, []);
  useEffect(() => {
    if (!isIllustration || illustrations) return;
    let active = true; setIllustrationBusy(true); setIllustrationError('');
    loadIllustrations().then(result => { if (active) setIllustrations(result); }).catch(() => { if (active) setIllustrationError('手绘样例未能加载，请刷新重试。'); }).finally(() => { if (active) setIllustrationBusy(false); });
    return () => { active = false; };
  }, [isIllustration, illustrations]);
  useEffect(() => {
    const font = BACK_TEXT_FONTS.find((item) => item.id === textLayer.font);
    if (!font) return;
    let active = true;
    document.fonts.load(`${font.weight} 128px ${font.family.split(',')[0]}`).then(() => { if (active) setFontRevision((revision) => revision + 1); }).catch(() => {});
    return () => { active = false; };
  }, [textLayer.font]);
  useEffect(() => { if (screenPortrait) { const screens = renderPortraitScreens(screenPortrait, { textLayer }); viewer.setScreenCanvas(screens.inner, 'inner'); viewer.setScreenCanvas(screens.outer, 'outer'); } }, [screenPortrait, textLayer, fontRevision, viewer]);
  useEffect(() => { viewer.setScreenAppearance({ color: effectiveColor, mode: 'original', compare: false }); }, [effectiveColor, viewer]);
  useEffect(() => {
    const stage = document.getElementById('stage');
    stage?.classList.toggle('social-view-active', step === 2 || step === 4);
    stage?.classList.toggle('motion-view-active', step === 4);
    return () => stage?.classList.remove('social-view-active', 'motion-view-active');
  }, [step]);
  useEffect(() => {
    if (!colorPlaying || !activeSource || (isIllustration && illustrationStyle !== 'color')) return;
    const colors = activeSeries.cards;
    if (colors.length < 2) return;
    const timer = window.setInterval(() => {
      setColor((current) => {
        const index = colors.findIndex((card) => card.hex === current);
        return colors[(index + 1 + colors.length) % colors.length].hex;
      });
    }, colorInterval);
    return () => window.clearInterval(timer);
  }, [colorPlaying, colorInterval, activeSource, activeSeries, isIllustration, illustrationStyle]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  async function save() {
    if (!activeSource || exporting || activeBusy) return;
    setExporting(true); setError('');
    try {
      if (step === 4) await motionControls.current?.savePNG();
      else await downloadAvatar(activeSource.canvas, options);
      setToast(step === 4 ? '动效画面已保存，请查看浏览器下载。' : '头像已准备好，请查看浏览器下载。');
    }
    catch (e) { setError(e.message); } finally { setExporting(false); }
  }
  function moveEditorTo(x, y) {
    const editor = editorRef.current;
    if (!editor) return;
    const bounds = editor.getBoundingClientRect();
    const baseLeft = bounds.left - editorOffset.current.x;
    const baseTop = bounds.top - editorOffset.current.y;
    const horizontalSpace = window.innerWidth - 24;
    const stageBounds = document.getElementById('stage')?.getBoundingClientRect();
    const socialDesktop = (step === 2 || step === 4) && window.innerWidth > 760 && stageBounds;
    const verticalTop = socialDesktop ? stageBounds.top + 12 : 12;
    const verticalBottom = socialDesktop ? stageBounds.bottom - 48 : window.innerHeight - 12;
    const verticalSpace = verticalBottom - verticalTop;
    const minX = 12 - baseLeft;
    const maxX = bounds.width <= horizontalSpace ? window.innerWidth - 12 - baseLeft - bounds.width : window.innerWidth - 48 - baseLeft;
    const minY = verticalTop - baseTop;
    const maxY = bounds.height <= verticalSpace ? verticalBottom - baseTop - bounds.height : verticalBottom - baseTop - 48;
    const nextX = Math.min(Math.max(x, minX), Math.max(minX, maxX));
    const nextY = Math.min(Math.max(y, minY), Math.max(minY, maxY));
    setEditorOffset(nextX, nextY);
  }
  function setEditorOffset(x, y) {
    editorOffset.current = { x, y };
    editorRef.current?.style.setProperty('--editor-drag-x', `${x}px`);
    editorRef.current?.style.setProperty('--editor-drag-y', `${y}px`);
  }
  function startEditorDrag(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    activeEditorDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: editorOffset.current.x, offsetY: editorOffset.current.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    editorRef.current?.classList.add('is-moving');
  }
  function onEditorDrag(event) {
    const drag = activeEditorDrag.current;
    if (drag?.pointerId !== event.pointerId) return;
    moveEditorTo(drag.offsetX + event.clientX - drag.x, drag.offsetY + event.clientY - drag.y);
  }
  function endEditorDrag(event) {
    if (activeEditorDrag.current?.pointerId !== event.pointerId) return;
    activeEditorDrag.current = null;
    editorRef.current?.classList.remove('is-moving');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function onEditorDragKey(event) {
    const delta = event.shiftKey ? 40 : 12;
    const movement = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] }[event.key];
    if (movement) { event.preventDefault(); moveEditorTo(editorOffset.current.x + movement[0], editorOffset.current.y + movement[1]); }
    else if (event.key === 'Home') { event.preventDefault(); setEditorOffset(0, 0); }
  }
  return <>
    <header className="studio-header"><a className="wordmark" href="#" onClick={(e) => { e.preventDefault(); setStep(0); }} aria-label={t('Tone Duo 首页')}>tone<span className="brand-slash">/</span>duo<i /></a><div className="header-actions"><button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={t(theme === 'light' ? '关灯' : '开灯')} aria-pressed={theme === 'dark'} title={t(theme === 'light' ? '关灯' : '开灯')}><span className="theme-toggle-icon" key={theme}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</span><span className="theme-toggle-label">{t(theme === 'light' ? '关灯' : '开灯')}</span></button><button type="button" className="language-switch" onClick={toggleLanguage} aria-label={language === 'zh' ? 'Switch to English' : '切换到中文'} title={language === 'zh' ? 'Switch to English' : '切换到中文'}><span className={language === 'zh' ? 'active' : ''}>中</span><span className="language-divider" aria-hidden="true">/</span><span className={language === 'en' ? 'active' : ''}>EN</span></button><button className="header-save" onClick={() => setStep(3)}>{t('我的头像')} <ArrowUpRight size={16} /></button></div></header>
    <section className="stage-copy" aria-live="polite" key={`${step}-${language}`}><p className="eyebrow"><i /> {t('A PORTRAIT, TWO EXPRESSIONS')}</p><h1>{t(steps[step].title[0])}<br />{t(steps[step].title[1])}</h1><p className="stage-description">{t(steps[step].copy)}</p></section>
    {step === 2 && <SocialPreview image={currentImage} color={effectiveColor} colorName={isIllustration && illustrationStyle !== 'color' ? illustrationStyle === 'line' ? 'Line' : 'Solid' : selected?.name} language={language} />}
    {step === 4 && <MotionPreview layers={avatarLayers} color={effectiveColor} series={motionSeries} allColors={allColors} options={{ ...options, fontRevision }} settings={motionSettings} onSettings={setMotionSettings} playing={motionPlaying} onPlaying={setMotionPlaying} editing={motionEditing} onEditing={setMotionEditing} controlsRef={motionControls} t={t} />}
    {step !== 2 && step !== 4 && !ready && !viewerError && <div className="viewer-loading" role="status"><LoaderCircle className="spin" size={17} /> {t('正在展开你的工作室…')}</div>}
    {step !== 2 && step !== 4 && viewerError && <div className="flat-fallback"><Preview image={currentImage} label={t('平面头像预览')} /><p>{t('设备预览暂不可用，仍可编辑和下载头像。')}</p></div>}
    <div className="stage-bottom"><DeviceFoldControl viewer={viewer} t={t} /><nav className="steps" aria-label={t('头像制作步骤')}>{steps.map((s, i) => <button key={s.name} aria-current={step === i ? 'step' : undefined} className={`${i === 4 ? 'motion-entry' : ''} ${step === i ? 'active' : ''}`} onClick={() => setStep(i)}>{i === 4 && <Sparkles size={15} />}<span>{t(s.name)}</span></button>)}</nav></div>
    <div className={`editor-wrap ${showCrop || showText ? 'is-expanded' : ''}`}>
    <aside ref={editorRef} className={`editor ${dragging ? 'dragging' : ''}`} aria-label={t('头像编辑器')} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }} onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files[0]); }}>
      <div className="editor-top editor-drag-handle" role="button" tabIndex={0} aria-label={t('拖动头像编辑器；双击恢复居中')} title={t('拖动面板，双击恢复居中')} onPointerDown={startEditorDrag} onPointerMove={onEditorDrag} onPointerUp={endEditorDrag} onPointerCancel={endEditorDrag} onLostPointerCapture={() => { activeEditorDrag.current = null; editorRef.current?.classList.remove('is-moving'); }} onDoubleClick={() => setEditorOffset(0, 0)} onKeyDown={onEditorDragKey}><span>{t('你的头像工作室')}</span><span className="edition editor-drag-hint"><Grip size={14} aria-hidden="true" /> {t('拖动')}</span></div>
      <div className="editor-scroll">
        {step === 4 && <MotionControls settings={motionSettings} onSettings={setMotionSettings} onPlaying={setMotionPlaying} onEditing={setMotionEditing} controlsRef={motionControls} t={t} />}
        <section className="portrait-family-section"><div className="section-heading"><span className="section-label">{t('头像风格')}</span></div><div className="portrait-family-options" role="group" aria-label={t('头像风格')}><button type="button" aria-pressed={!isIllustration} onClick={() => { setPortraitFamily('photo'); setColorPlaying(false); resetCrop(); }}>{t('照片')}</button><button type="button" aria-pressed={isIllustration} onClick={() => { setPortraitFamily('illustration'); setColorPlaying(false); resetCrop(); }}>{t('简约手绘')}</button></div></section>
        <section><div className="section-heading"><span className="section-label">{t(isIllustration ? '手绘样例' : '照片')}</span><button className="text-button" onClick={() => setShowCrop((v) => !v)} aria-expanded={showCrop}>{t(showCrop ? '收起调整' : '调整构图')} <ArrowUpRight size={12} /></button></div>
          <div className="photo-row"><div className="portrait-frame"><Preview image={currentImage} label={t('当前头像预览')} />{activeBusy && <div className="portrait-busy"><LoaderCircle size={22} className="spin" /></div>}</div><div className="photo-actions">{isIllustration ? <><strong>{t(illustrationSubject === 'male' ? '男生' : '女生')} · {illustrationStyle[0].toUpperCase() + illustrationStyle.slice(1)}</strong><p>{t('已确认的男女样例。')}<br />{t('照片转手绘尚未开放。')}</p></> : <><button className="upload-button" onClick={() => input.current.click()} disabled={Boolean(busy)}><ImagePlus size={15} /> {t('上传你的照片')}</button><p>{t('也可拖入一张照片')}<br />JPG / PNG / WebP · {t('25 MB 内')}</p></>}</div></div>
          <input className="sr-only" type="file" ref={input} accept="image/png,image/jpeg,image/webp,image/avif" aria-label={t('上传照片文件')} onChange={(e) => { upload(e.target.files[0]); e.target.value = ''; }} />
          <p className="photo-status" role="status">{isIllustration ? t(illustrationError || (illustrationBusy ? '正在加载手绘样例…' : '选风格、调配色，然后查看社媒对比。')) : busy ? t(busy) : source?.name === '默认人物.png' ? t('当前为默认人物；可上传自己的照片。') : source?.name || t('选择一张清晰的正面照片。')}</p>
          {showCrop && <div className="crop-controls"><Range label={t('人像大小')} value={zoom} min={.65} max={2} onChange={setZoom} display={`${Math.round(zoom * 100)}%`} /><Range label={t('左右位置')} value={x} min={-.5} max={.5} onChange={setX} display={Math.round(x * 100)} /><Range label={t('上下位置')} value={y} min={-.5} max={.5} onChange={setY} display={Math.round(y * 100)} /><button className="text-button" onClick={resetCrop}>{t('重置构图')} <RotateCcw size={12} /></button></div>}
        </section>
        <section className="back-text-section"><button type="button" className="back-text-toggle" aria-expanded={showText} onClick={() => setShowText((open) => !open)}><span>{t('头像背后文字')}</span><span>{t(showText ? '收起' : '展开')} <ArrowUpRight size={14} /></span></button>
          {showText && <div className="back-text-content">
            <p className="back-text-help">{t('文字放在人像后方，可输入自己的内容。')}</p>
            <label className="back-text-field">{t('文字内容')}<textarea aria-label={t('头像背后文字内容')} value={textLayer.text} rows={2} maxLength={120} placeholder={t('输入中文或 English，可换行')} onChange={(e) => setTextLayer((layer) => ({ ...layer, text: e.target.value }))} /></label>
            <label className="back-text-field back-text-preset">{t('示例文字')}<select aria-label={t('选择示例文字')} value="" onChange={(e) => { if (e.target.value) setTextLayer((layer) => ({ ...layer, text: e.target.value })); }}><option value="">{t('选择一句文字…')}</option>{textPresets[language].map((phrase) => <option key={phrase} value={phrase}>{phrase}</option>)}</select></label>
            <div className="back-text-options"><label>{t('字体')}<select aria-label={t('头像背后文字字体')} value={textLayer.font} onChange={(e) => setTextLayer((layer) => ({ ...layer, font: e.target.value }))}>{BACK_TEXT_FONTS.map((font) => <option key={font.id} value={font.id}>{t(font.label)}</option>)}</select></label><label>{t('文字颜色')}<input type="color" aria-label={t('头像背后文字颜色')} value={textLayer.color} onChange={(e) => setTextLayer((layer) => ({ ...layer, color: e.target.value }))} /></label></div>
            <Range label={t('文字大小')} value={textLayer.size} min={24} max={640} step={1} display={`${textLayer.size} px`} onChange={(value) => setTextLayer((layer) => ({ ...layer, size: value }))} />
            <Range label={t('左右位置')} value={textLayer.x} min={-.4} max={.4} display={`${Math.round(textLayer.x * 100)}%`} onChange={(value) => setTextLayer((layer) => ({ ...layer, x: value }))} />
            <Range label={t('上下位置')} value={textLayer.y} min={-.4} max={.4} display={`${Math.round(textLayer.y * 100)}%`} onChange={(value) => setTextLayer((layer) => ({ ...layer, y: value }))} />
          </div>}
        </section>
        {isIllustration && <IllustrationControls subject={illustrationSubject} onSubject={value => { setIllustrationSubject(value); resetCrop(); }} style={illustrationStyle} onStyle={value => { setIllustrationStyle(value); setColorPlaying(false); }} images={illustrationImages} Preview={Preview} makeup={makeup} onMakeup={setMakeup} materials={illustrationMaterials[illustrationSubject]} onMaterials={next => setIllustrationMaterials(current => ({ ...current, [illustrationSubject]: next }))} cards={activeSeries.cards} t={t} />}
        {!isIllustration && <section className="mode-section"><div className="section-heading"><span className="section-label">{t('人像模式')}</span><span className="section-hint">{t('点击切换人像效果')}</span></div>
          <div className="mode-options" role="group" aria-label={t('人像模式')}>{[{ id: 'tint', title: '同色微染' }, { id: 'neutral', title: '中性黑白' }, { id: 'original', title: '保留原色' }].map((m) => <button key={m.id} className={`mode-card ${mode === m.id ? 'selected' : ''}`} onClick={() => setMode(m.id)} aria-pressed={mode === m.id}><Preview image={images?.[m.id]} label={`${t(m.title)} ${t('示例')}`} /><span className="mode-copy"><span className="mode-title">{t(m.title)}</span></span></button>)}</div>
          {mode === 'tint' && <Range label={t('染色程度')} value={strength} min={.1} max={.8} onChange={setStrength} display={t(strength < .4 ? '轻柔' : strength < .6 ? '适中' : '明显')} />}
        </section>}
        {( !isIllustration || illustrationStyle === 'color') && <section className="color-section"><div className="section-heading"><span className="section-label">{t('背景颜色')}</span><div className="color-heading-actions"><span className="color-value">{t(selected?.name)} <code>{color}</code></span><button type="button" className={`color-play-button ${colorPlaying ? 'is-playing' : ''}`} style={{ '--cycle-duration': `${colorInterval}ms` }} aria-label={t(colorPlaying ? '暂停自动换色' : '播放自动换色')} aria-pressed={colorPlaying} title={t(colorPlaying ? '暂停自动换色' : '播放自动换色')} disabled={!source} onClick={() => setColorPlaying((playing) => !playing)}>{colorPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button></div></div>
          <label className="color-speed-control"><span>{t('换色速度')}</span><input type="range" aria-label={t('换色速度')} aria-valuetext={`${(colorInterval / 1000).toFixed(1)} ${t('秒/色')}`} min="400" max="2400" step="100" value={colorInterval} onChange={(event) => setColorInterval(Number(event.target.value))} /><output>{(colorInterval / 1000).toFixed(1)} {t('秒/色')}</output></label>
          <div className="family-tabs" role="group" aria-label={t('色系分类')}>{palette.families.map((family) => <button key={family.id} type="button" aria-pressed={activeFamily === family.id} onClick={() => { const first = palette.series.find((series) => series.family === family.id); setSeriesId(first.id); setColor(first.cards[0].hex); }}><span>{t(family.name)}</span><small>{palette.series.filter((series) => series.family === family.id).flatMap(seriesColors).length}</small></button>)}</div>
          <div className="series-list" role="group" aria-label={t('选择色系')}>{palette.series.filter((series) => series.family === activeFamily).map((series) => <button key={series.id} type="button" className={`series-tab ${seriesId === series.id ? 'active' : ''}`} aria-pressed={seriesId === series.id} onClick={() => { setSeriesId(series.id); setColor(series.cards[0].hex); }}><i style={{ '--series-accent': series.accent }} /><span>{t(series.name)}</span><small>{seriesColors(series).length}</small></button>)}</div>
          <div className="series-panel" key={activeSeries.id}>
            <div className="series-meta"><span>{t(activeSeries.subtitle)}</span><span>{t(activeSeries.source)}</span></div>
            <div className="swatches">{activeSeries.cards.map((card) => <ColorSwatch key={card.id} card={card} selected={color} onSelect={() => setColor(card.hex)} t={t} />)}</div>
          </div>
          <p className="palette-note"><i /> {palette.series.length}{t('个色系')} · {allColors.length}{t('款颜色')}</p>
        </section>}
        {error && <div className="error-message" role="alert"><span>{t(error)}</span><button aria-label={t('关闭提示')} onClick={() => setError('')}><X size={15} /></button></div>}
      </div>
      <div className="editor-footer"><button className="download-button" onClick={save} disabled={!activeSource || activeBusy || exporting}>{exporting ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />} {t(exporting ? '正在保存…' : step === 4 ? '保存当前动效画面' : '下载头像')} <span>PNG ↗</span></button><p><i /> {t(step === 4 ? '方形 PNG · 1200 × 1200 px' : step === 3 ? '方形 PNG · 1024 × 1024 px' : isIllustration ? '手绘样例 · 本机配色与导出' : '照片仅在本机处理')}</p></div>
    </aside>
    </div>
    <footer className="site-footer"><span>TONE DUO — A LITTLE COLOR, A LITTLE YOU.</span><a href="https://github.com/bravohenry/iphone-duo-motion-study" target="_blank" rel="noreferrer">Duo motion study <ArrowUpRight size={11} /></a></footer>
    {toast && <div className="toast" role="status"><Check size={16} />{t(toast)}</div>}
  </>;
}
