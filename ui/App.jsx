/** Avatar editor, social previews, and draggable panel; device motion stays in the viewer. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ProductHome } from './ProductHome.jsx';
import { SavedLooks } from './SavedLooks.jsx';
import { addSavedLook, lookSignature, selectedLooks } from '../app/saved-looks.js';
import { DeliveryPanel } from './DeliveryPanel.jsx';
import { canvasBlob, exportAvatarPackage, exportSavedLooks } from '../app/avatar-package.js';
import { readDraft, writeDraft, decodeDraftPhoto, readLooks, writeLooks } from '../app/draft-store.js';
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
  const [home, setHome] = useState(!initialIllustrationStyle && !initialView.get('view') && window.location.hash !== '#studio');
  const [draft, setDraft] = useState(null), [draftBusy, setDraftBusy] = useState(false);
  const [exportSize, setExportSize] = useState(1024);
  const [photoId, setPhotoId] = useState('photo:default');
  const [collection, setCollection] = useState({ key: null, items: [] });
  const [lookBusy, setLookBusy] = useState(false), [selectedLookIds, setSelectedLookIds] = useState([]);
  useEffect(() => { readDraft().then(setDraft).catch(() => {}); }, []);
  useEffect(() => { const onBack = () => setHome(window.location.hash !== '#studio' && !new URLSearchParams(window.location.search).get('style') && !new URLSearchParams(window.location.search).get('view')); window.addEventListener('popstate', onBack); return () => window.removeEventListener('popstate', onBack); }, []);
  function showHome(value) { if (home !== value) window.history.pushState(null, '', window.location.pathname + (value ? '' : '#studio')); setHome(value); window.scrollTo(0, 0); }
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
  const portraitKey = isIllustration ? 'illustration:' + illustrationSubject : photoId;
  const portraitKeyRef = useRef(portraitKey); portraitKeyRef.current = portraitKey;
  const looksReady = collection.key === portraitKey && !collection.error;
  const looks = looksReady ? collection.items : [];
  useEffect(() => {
    let active = true;
    readLooks(portraitKey).then(items => { if (active) { setCollection({ key: portraitKey, items }); setSelectedLookIds(items.map(item => item.id)); } }).catch(() => { if (active) { setCollection({ key: portraitKey, items: [], error: true }); setSelectedLookIds([]); setError('本机收藏暂不可用，你仍可下载当前配色。'); } });
    return () => { active = false; };
  }, [portraitKey]);
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
    try { const result = await loadPortrait(file, (message) => { if (id === request.current) setBusy(message); }); if (id === request.current) { setSource(result); setPhotoId('photo:' + crypto.randomUUID()); setPortraitFamily('photo'); setColorPlaying(false); resetCrop(); setStep((current) => current === 4 ? 4 : 1); } }
    catch (e) { if (id === request.current) setError(e.message || '处理失败，请换一张清晰的照片重试。'); }
    finally { if (id === request.current) setBusy(''); }
  }
  useEffect(() => { prepareDefault(); return () => { request.current++; }; }, []);
  useEffect(() => {
    if (!isIllustration || illustrations) { setIllustrationBusy(false); return; }
    let active = true; setIllustrationBusy(true); setIllustrationError('');
    loadIllustrations().then(result => { if (active) { setIllustrationBusy(false); setIllustrations(result); } }).catch(() => { if (active) { setIllustrationBusy(false); setIllustrationError('手绘样例未能加载，请刷新重试。'); } });
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
      else await downloadAvatar(activeSource.canvas, { ...options, size: exportSize });
      setToast(step === 4 ? '动效画面已保存，请查看浏览器下载。' : '头像已准备好，请查看浏览器下载。');
    }
    catch (e) { setError(e.message); } finally { setExporting(false); }
  }
  function snapshotSettings() {
    return { photoId, portraitFamily, illustrationStyle, illustrationSubject, illustrationMaterials, makeup, color, mode, seriesId, strength, zoom, x, y, textLayer, motionSettings, exportSize };
  }
  async function saveDraft() {
    if (!activeSource || activeBusy || draftBusy || lookBusy) return;
    setDraftBusy(true); setError('');
    try {
      const settings = snapshotSettings();
      const photo = isIllustration ? null : await canvasBlob(source.canvas);
      const thumbnail = currentImage ? await canvasBlob(currentImage) : null;
      setDraft(await writeDraft(settings, photo, thumbnail, source?.name));
      setToast('草稿已保存在当前浏览器。');
    } catch { setError('草稿未能保存，请检查浏览器存储空间。你仍可下载头像。'); }
    finally { setDraftBusy(false); }
  }
  function applySettings(s) {
    setPortraitFamily(s.portraitFamily); setIllustrationStyle(s.illustrationStyle); setIllustrationSubject(s.illustrationSubject);
    setIllustrationMaterials(s.illustrationMaterials); setMakeup(s.makeup); setColor(s.color); setMode(s.mode); setSeriesId(s.seriesId);
    setStrength(s.strength); setZoom(s.zoom); setX(s.x); setY(s.y); setTextLayer(s.textLayer); setMotionSettings(s.motionSettings); setExportSize(s.exportSize || 1024);
  }
  async function restoreDraft() {
    if (!draft || draftBusy) return;
    setDraftBusy(true); setError('');
    try {
      const saved = await readDraft();
      if (!saved) throw Error('未找到草稿，可能已被清除。');
      const s = saved.settings;
      const restored = s.portraitFamily === 'photo' ? await decodeDraftPhoto(saved.photo, saved.sourceName || '我的照片') : null;
      ++request.current; setBusy('');
      if (restored) setSource(restored);
      applySettings(s); setPhotoId(s.photoId || 'photo:' + crypto.randomUUID());
      setColorPlaying(false); setStep(1); showHome(false); setToast('已恢复上次保存的人物与设置。');
    } catch (e) { setError(e.message || '草稿恢复失败，请重试。'); }
    finally { setDraftBusy(false); }
  }
  async function savePackage() {
    if (!activeSource || activeBusy || exporting) return;
    setExporting(true); setError(''); setColorPlaying(false);
    try {
      const versions = renderSet(snapshotSettings());
      await exportAvatarPackage(versions, snapshotSettings()); setToast('头像套装已准备好，请查看浏览器下载。');
    } catch (e) { setError(e.message || '套装导出失败，请重试。'); }
    finally { setExporting(false); }
  }
  function renderSet(s) {
    const illustrated = s.portraitFamily === 'illustration';
    return (illustrated ? ['line', 'solid', 'color'] : ['original', 'neutral', 'tint']).map(version => {
      const item = illustrated ? composeIllustration(illustrations, { subject: s.illustrationSubject, style: version, materials: s.illustrationMaterials[s.illustrationSubject], ...s.makeup }) : source;
      const layers = prepareAvatarLayers(item.canvas, { zoom: s.zoom, x: s.x, y: s.y });
      return { name: version, canvas: renderPreparedAvatar(layers, { color: illustrated && version !== 'color' ? '#FFFFFF' : s.color, mode: illustrated ? 'original' : version, strength: s.strength, textLayer: s.textLayer, size: 1024 }) };
    });
  }
  async function saveLook() {
    if (!activeSource || activeBusy || draftBusy || lookBusy || !looksReady) return;
    setColorPlaying(false); setError(''); setLookBusy(true);
    const key = portraitKey, settings = snapshotSettings();
    try {
      const items = addSavedLook(looks, { id: crypto.randomUUID(), settings, thumbnail: currentImage.toDataURL('image/png'), createdAt: Date.now() });
      const photo = isIllustration ? null : await canvasBlob(source.canvas);
      const saved = await writeDraft(settings, photo, await canvasBlob(currentImage), source?.name, { key, items });
      setDraft(saved);
      if (portraitKeyRef.current === key) { setCollection({ key, items }); setSelectedLookIds(ids => [...ids, items.at(-1).id]); }
      setToast('配色已收藏，本机草稿已同步更新。');
    } catch (e) { setError(e.message || '配色未能保存，请检查浏览器存储空间。'); }
    finally { setLookBusy(false); }
  }
  async function updateLooks(items) {
    if (lookBusy || !looksReady) return;
    const key = portraitKey; setLookBusy(true); setError('');
    try { await writeLooks(key, items); if (portraitKeyRef.current === key) { setCollection({ key, items }); setSelectedLookIds(ids => ids.filter(id => items.some(item => item.id === id))); } }
    catch { setError('配色未能保存，请检查浏览器存储空间。'); }
    finally { setLookBusy(false); }
  }
  function restoreLook(item) {
    if (activeBusy || exporting || item.settings.portraitFamily !== portraitFamily) return;
    applySettings(item.settings); setColorPlaying(false); setStep(1); setToast('已恢复收藏配色，可以继续编辑。');
  }
  async function downloadLook(item) {
    if (activeBusy || exporting) return;
    setExporting(true); setError('');
    try {
      const s = item.settings, illustrated = s.portraitFamily === 'illustration';
      const font = BACK_TEXT_FONTS.find(f => f.id === s.textLayer.font);
      if (s.textLayer.text && font) await document.fonts.load(font.weight + ' 128px ' + font.family.split(',')[0]);
      const itemSource = illustrated ? composeIllustration(illustrations, { subject: s.illustrationSubject, style: s.illustrationStyle, materials: s.illustrationMaterials[s.illustrationSubject], ...s.makeup }) : source;
      await downloadAvatar(itemSource.canvas, { ...s, color: illustrated && s.illustrationStyle !== 'color' ? '#FFFFFF' : s.color, mode: illustrated ? 'original' : s.mode, style: illustrated ? s.illustrationStyle : null, size: exportSize });
      setToast('收藏配色已准备好，请查看浏览器下载。');
    } catch (e) { setError(e.message || '收藏导出失败，请重试。'); }
    finally { setExporting(false); }
  }
  async function downloadCollection() {
    const chosen = selectedLooks(looks, selectedLookIds);
    if (!activeSource || activeBusy || exporting || !chosen.length) return;
    setExporting(true); setError(''); setColorPlaying(false);
    try {
      await exportSavedLooks(chosen, async s => {
        const font = BACK_TEXT_FONTS.find(f => f.id === s.textLayer.font);
        if (s.textLayer.text && font) await document.fonts.load(font.weight + ' 128px ' + font.family.split(',')[0]);
        return renderSet(s);
      });
      setToast('收藏套装已准备好，请查看浏览器下载。');
    } catch (e) { setError(e.message || '收藏导出失败，请重试。'); }
    finally { setExporting(false); }
  }
  function savedLooksPanel(expanded = false) {
    return <SavedLooks items={looks} selectedIds={selectedLookIds} onSelect={(id, on) => setSelectedLookIds(ids => on ? [...new Set([...ids, id])] : ids.filter(value => value !== id))} onSave={saveLook} onRestore={restoreLook} onDelete={id => updateLooks(looks.filter(item => item.id !== id))} onRename={(id, name) => updateLooks(looks.map(item => item.id === id ? { ...item, name } : item))} onDownload={downloadLook} busy={lookBusy || exporting || draftBusy || collection.key !== portraitKey} available={Boolean(activeSource) && !activeBusy && looksReady} t={t} expanded={expanded} currentSignature={lookSignature(snapshotSettings())} signatureOf={lookSignature} />;
  }
  function startSample(style = 'color') { setPortraitFamily('illustration'); setIllustrationSubject('woman'); setIllustrationStyle(style); setMakeup({ blush: { on: true, color: '#efcbac', strength: 45 }, lips: { on: true, color: '#e53935', strength: 46 } }); setColor('#C0D9F0'); setIllustrationMaterials(current => ({ ...current, woman: { clothing: '#F9D3AF' } })); setColorPlaying(false); resetCrop(); setStep(1); showHome(false); }
  useEffect(() => {
    const stage = document.getElementById('stage');
    stage?.classList.toggle('product-home-active', home);
    stage?.classList.toggle('illustration-view-active', !home && isIllustration && step !== 2 && step !== 4);
    return () => stage?.classList.remove('product-home-active', 'illustration-view-active');
  }, [home, isIllustration, step]);
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
    <a className="skip-link" href={home ? '#studio-content' : '#editor-content'}>{t('跳到主要内容')}</a>
    <input className="sr-only" type="file" ref={input} accept="image/png,image/jpeg,image/webp,image/avif" aria-label={t('上传照片文件')} onChange={(e) => { showHome(false); upload(e.target.files[0]); e.target.value = ''; }} />
    <header className="studio-header"><a className="wordmark" href="#" onClick={(e) => { e.preventDefault(); showHome(true); }} aria-label={t('Tone Duo 首页')}>tone<span className="brand-slash">/</span>duo<i /></a><div className="header-actions"><button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={t(theme === 'light' ? '关灯' : '开灯')} aria-pressed={theme === 'dark'} title={t(theme === 'light' ? '关灯' : '开灯')}><span className="theme-toggle-icon" key={theme}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</span><span className="theme-toggle-label">{t(theme === 'light' ? '关灯' : '开灯')}</span></button><button type="button" className="language-switch" onClick={toggleLanguage} aria-label={language === 'zh' ? 'Switch to English' : '切换到中文'} title={language === 'zh' ? 'Switch to English' : '切换到中文'}><span className={language === 'zh' ? 'active' : ''}>中</span><span className="language-divider" aria-hidden="true">/</span><span className={language === 'en' ? 'active' : ''}>EN</span></button><button className="header-save" onClick={() => { showHome(false); setStep(3); }}>{t('我的头像')} <ArrowUpRight size={16} /></button></div></header>
    {home ? <ProductHome onUpload={() => input.current.click()} onPhoto={() => { setPortraitFamily('photo'); setStep(0); showHome(false); }} onSample={startSample} draft={draft} onRestore={restoreDraft} working={draftBusy} t={t} Preview={Preview} language={language} /> : <>
    <section className="stage-copy" aria-live="polite" key={`${step}-${language}`}><p className="eyebrow"><i /> {t('A PORTRAIT, TWO EXPRESSIONS')}</p><h1>{t(steps[step].title[0])}<br />{t(steps[step].title[1])}</h1><p className="stage-description">{t(steps[step].copy)}</p></section>
    {isIllustration && step !== 2 && step !== 4 && <section className="illustration-stage" aria-label={t('三个版本对比')}><div><span className="product-kicker">THE ILLUSTRATION EDITION</span><h2>{t('同一个你，三种表达。')}</h2><p>{t('选择一个版本，配好颜色，再看看社媒效果。')}</p></div><div className="illustration-triptych">{['line', 'solid', 'color'].map(style => <button key={style} className={illustrationStyle === style ? 'chosen' : ''} aria-pressed={illustrationStyle === style} onClick={() => { setIllustrationStyle(style); setColorPlaying(false); }}><Preview image={illustrationImages?.[style]} label={style + ' ' + t('头像预览')} /><span>{style[0].toUpperCase() + style.slice(1)}<small>{illustrationStyle === style ? t('当前版本') : '↗'}</small></span></button>)}</div><p className="illustration-stage-note">{t('手绘样例展示 · 上传照片自动转绘尚未开放')}</p><button className="product-text-action" onClick={() => setStep(2)}>{t('放进社媒主页看看')}<ArrowUpRight size={16} /></button></section>}
    {step === 2 && <SocialPreview image={currentImage} color={effectiveColor} colorName={isIllustration && illustrationStyle !== 'color' ? illustrationStyle === 'line' ? 'Line' : 'Solid' : selected?.name} language={language} />}
    {step === 4 && <MotionPreview layers={avatarLayers} color={effectiveColor} series={motionSeries} allColors={allColors} options={{ ...options, fontRevision }} settings={motionSettings} onSettings={setMotionSettings} playing={motionPlaying} onPlaying={setMotionPlaying} editing={motionEditing} onEditing={setMotionEditing} controlsRef={motionControls} t={t} />}
    {!isIllustration && step !== 2 && step !== 4 && !ready && !viewerError && <div className="viewer-loading" role="status"><LoaderCircle className="spin" size={17} /> {t('正在展开你的工作室…')}</div>}
    {!isIllustration && step !== 2 && step !== 4 && viewerError && <div className="flat-fallback"><Preview image={currentImage} label={t('平面头像预览')} /><p>{t('设备预览暂不可用，仍可编辑和下载头像。')}</p></div>}
    <div className="stage-bottom">{!isIllustration && <DeviceFoldControl viewer={viewer} t={t} />}<nav className="steps" aria-label={t('头像制作步骤')}>{steps.map((s, i) => <button key={s.name} aria-current={step === i ? 'step' : undefined} className={`${i === 4 ? 'motion-entry' : ''} ${step === i ? 'active' : ''}`} onClick={() => setStep(i)}>{i === 4 && <Sparkles size={15} />}<span>{t(s.name)}</span></button>)}</nav></div>
    <div className={`editor-wrap ${showCrop || showText ? 'is-expanded' : ''}`}>
    <aside ref={editorRef} className={`editor ${dragging ? 'dragging' : ''}`} aria-label={t('头像编辑器')} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }} onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files[0]); }}>
      <div className="editor-top editor-drag-handle" role="button" tabIndex={0} aria-label={t('拖动头像编辑器；双击恢复居中')} title={t('拖动面板，双击恢复居中')} onPointerDown={startEditorDrag} onPointerMove={onEditorDrag} onPointerUp={endEditorDrag} onPointerCancel={endEditorDrag} onLostPointerCapture={() => { activeEditorDrag.current = null; editorRef.current?.classList.remove('is-moving'); }} onDoubleClick={() => setEditorOffset(0, 0)} onKeyDown={onEditorDragKey}><span>{t('你的头像工作室')}</span><span className="edition editor-drag-hint"><Grip size={14} aria-hidden="true" /> {t('拖动')}</span></div>
      <div className="editor-scroll" id="editor-content" tabIndex={-1}>
        {step === 3 ? <DeliveryPanel illustration={isIllustration} currentImage={currentImage} Preview={Preview} size={exportSize} onSize={setExportSize} onSave={save} onPackage={savePackage} onDraft={saveDraft} onEdit={() => setStep(1)} savedLooks={savedLooksPanel(true)} onCollection={downloadCollection} selectedCount={selectedLooks(looks, selectedLookIds).length} exporting={exporting} draftBusy={draftBusy} draftSavedAt={draft?.savedAt} available={Boolean(activeSource) && !activeBusy} t={t} /> : <>
        {step === 4 && <MotionControls settings={motionSettings} onSettings={setMotionSettings} onPlaying={setMotionPlaying} onEditing={setMotionEditing} controlsRef={motionControls} t={t} />}
        <section className="portrait-family-section"><div className="section-heading"><span className="section-label">{t('头像风格')}</span></div><div className="portrait-family-options" role="group" aria-label={t('头像风格')}><button type="button" aria-pressed={!isIllustration} onClick={() => { setPortraitFamily('photo'); setColorPlaying(false); resetCrop(); }}>{t('照片')}</button><button type="button" aria-pressed={isIllustration} onClick={() => { setPortraitFamily('illustration'); setColorPlaying(false); resetCrop(); }}>{t('简约手绘')}</button></div></section>
        <section><div className="section-heading"><span className="section-label">{t(isIllustration ? '手绘样例' : '照片')}</span><button className="text-button" onClick={() => setShowCrop((v) => !v)} aria-expanded={showCrop}>{t(showCrop ? '收起调整' : '调整构图')} <ArrowUpRight size={12} /></button></div>
          <div className="photo-row"><div className="portrait-frame"><Preview image={currentImage} label={t('当前头像预览')} />{activeBusy && <div className="portrait-busy"><LoaderCircle size={22} className="spin" /></div>}</div><div className="photo-actions">{isIllustration ? <><strong>{t(illustrationSubject === 'male' ? '男生' : '女生')} · {illustrationStyle[0].toUpperCase() + illustrationStyle.slice(1)}</strong><p>{t('已确认的男女样例。')}<br />{t('照片转手绘尚未开放。')}</p></> : <><button className="upload-button" onClick={() => input.current.click()} disabled={Boolean(busy)}><ImagePlus size={15} /> {t('上传你的照片')}</button><p>{t('也可拖入一张照片')}<br />JPG / PNG / WebP · {t('25 MB 内')}</p></>}</div></div>

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
        {( !isIllustration || illustrationStyle === 'color') && <section className="color-section"><div className="section-heading"><span className="section-label">{t('背景颜色')}</span><div className="color-heading-actions"><span className="color-value">{t(selected?.name)} <code>{color}</code></span><button type="button" className={`color-play-button ${colorPlaying ? 'is-playing' : ''}`} style={{ '--cycle-duration': `${colorInterval}ms` }} aria-label={t(colorPlaying ? '暂停自动换色' : '播放自动换色')} aria-pressed={colorPlaying} title={t(colorPlaying ? '暂停自动换色' : '播放自动换色')} disabled={!activeSource} onClick={() => setColorPlaying((playing) => !playing)}>{colorPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button></div></div>
          {isIllustration && <div className="outfit-presets"><span>{t('一键配色')}</span>{[{ label: '晴空杏色', background: '#C0D9F0', clothing: '#F9D3AF' }, { label: '樱粉深蓝', background: '#F7BCDA', clothing: '#0E1531' }, { label: '薄荷森林', background: '#C5E1D5', clothing: '#063138' }].map(preset => <button key={preset.label} aria-label={t(preset.label)} onClick={() => { setColor(preset.background); if (illustrationSubject === 'woman') setIllustrationMaterials(current => ({ ...current, woman: { ...current.woman, clothing: preset.clothing } })); setColorPlaying(false); }}><i style={{ background: preset.background }} /><i style={{ background: preset.clothing }} /><span>{t(preset.label)}</span></button>)}</div>}
          <label className="studio-custom-color">{t('自定义背景')}<input type="color" value={color} aria-label={t('自定义背景颜色')} onChange={e => { setColor(e.target.value); setColorPlaying(false); }} /></label>
          <label className="color-speed-control"><span>{t('换色速度')}</span><input type="range" aria-label={t('换色速度')} aria-valuetext={`${(colorInterval / 1000).toFixed(1)} ${t('秒/色')}`} min="400" max="2400" step="100" value={colorInterval} onChange={(event) => setColorInterval(Number(event.target.value))} /><output>{(colorInterval / 1000).toFixed(1)} {t('秒/色')}</output></label>
          <div className="family-tabs" role="group" aria-label={t('色系分类')}>{palette.families.map((family) => <button key={family.id} type="button" aria-pressed={activeFamily === family.id} onClick={() => { const first = palette.series.find((series) => series.family === family.id); setSeriesId(first.id); setColor(first.cards[0].hex); }}><span>{t(family.name)}</span><small>{palette.series.filter((series) => series.family === family.id).flatMap(seriesColors).length}</small></button>)}</div>
          <div className="series-list" role="group" aria-label={t('选择色系')}>{palette.series.filter((series) => series.family === activeFamily).map((series) => <button key={series.id} type="button" className={`series-tab ${seriesId === series.id ? 'active' : ''}`} aria-pressed={seriesId === series.id} onClick={() => { setSeriesId(series.id); setColor(series.cards[0].hex); }}><i style={{ '--series-accent': series.accent }} /><span>{t(series.name)}</span><small>{seriesColors(series).length}</small></button>)}</div>
          <div className="series-panel" key={activeSeries.id}>
            <div className="series-meta"><span>{t(activeSeries.subtitle)}</span><span>{t(activeSeries.source)}</span></div>
            <div className="swatches">{activeSeries.cards.map((card) => <ColorSwatch key={card.id} card={card} selected={color} onSelect={() => setColor(card.hex)} t={t} />)}</div>
          </div>
          <p className="palette-note"><i /> {palette.series.length}{t('个色系')} · {allColors.length}{t('款颜色')}</p>
        </section>}
        {step !== 4 && savedLooksPanel()}
        </>}
        {error && <div className="error-message" role="alert"><span>{t(error)}</span><button aria-label={t('关闭提示')} onClick={() => setError('')}><X size={15} /></button></div>}
      </div>
      <div className="editor-footer">
        {step !== 3 && <div className="studio-next-actions"><button onClick={step === 4 ? saveDraft : saveLook} disabled={!activeSource || activeBusy || draftBusy || lookBusy || !looksReady || (step !== 4 && looks.length >= 5)}>{t(step === 4 ? draftBusy ? '正在保存草稿…' : '保存草稿' : lookBusy ? '正在保存配色…' : '收藏当前配色')}</button><button onClick={() => setStep(step === 2 ? 3 : 2)}>{t(step === 2 ? '选好，去下载' : '查看社媒对比')} <ArrowUpRight size={12} /></button></div>}
        {step !== 3 && <button className="download-button" onClick={save} disabled={!activeSource || activeBusy || exporting}>{exporting ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />} {t(exporting ? '正在保存…' : step === 4 ? '保存当前动效画面' : '下载头像')} <span>PNG ↗</span></button>}<p><i /> {t(step === 4 ? '方形 PNG · 1200 × 1200 px' : step === 3 ? 'PNG · ' + exportSize + ' × ' + exportSize + ' px' : isIllustration ? '手绘样例 · 本机配色与导出' : '照片仅在本机处理')}</p></div>
    </aside>
    </div>
    <footer className="site-footer"><span>TONE DUO — A LITTLE COLOR, A LITTLE YOU.</span><a href="https://github.com/bravohenry/iphone-duo-motion-study" target="_blank" rel="noreferrer">Duo motion study <ArrowUpRight size={11} /></a></footer>
    </>}
    {home && error && <div className="home-error" role="alert">{t(error)}<button onClick={() => setError('')} aria-label={t('关闭提示')}><X size={15} /></button></div>}
    {toast && <div className="toast" role="status"><Check size={16} />{t(toast)}</div>}
  </>;
}
