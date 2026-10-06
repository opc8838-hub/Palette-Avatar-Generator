/** Product entry: real capabilities, live sample artwork, and local draft recovery. */
import { useEffect, useState } from 'react';
import { ArrowUpRight, ImagePlus, ArrowRight } from 'lucide-react';
import { loadIllustrations, composeIllustration } from '../app/illustration-engine.js';
import { prepareAvatarLayers, renderPreparedAvatar } from '../app/avatar-engine.js';

export function ProductHome({ onUpload, onSample, onPhoto, draft, onRestore, working, t, Preview, language }) {
  const [art, setArt] = useState(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    loadIllustrations().then(assets => {
      const result = ['line', 'solid', 'color'].map(style => {
        const source = composeIllustration(assets, { subject: 'woman', style, materials: { clothing: '#F9D3AF' }, blush: { on: true, color: '#efcbac', strength: 45 }, lips: { on: true, color: '#e53935', strength: 46 } });
        return renderPreparedAvatar(prepareAvatarLayers(source.canvas), { color: style === 'color' ? '#C0D9F0' : '#FFFFFF', mode: 'original', size: 560 });
      });
      if (active) setArt(result);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  return <main id="studio-content" className="product-home" tabIndex={-1}>
    <section className="home-intro">
      <div className="home-story"><p className="product-kicker">THE PORTRAIT EDITION / 01</p><h1>{t('还是你。')}<br /><em>{t('换一种表达。')}</em></h1><p className="home-lead">{t('从一张照片开始，选好颜色，看看它在你的主页里是什么样子。')}</p><div className="home-actions"><button className="product-primary" onClick={onUpload}><ImagePlus size={17} />{t('上传照片开始')}<ArrowUpRight size={17} /></button><button className="product-text-action" onClick={() => onSample('color')}>{t('体验手绘样例')}<ArrowRight size={16} /></button></div><p className="home-meta">{t('照片本机处理 · 配色即时预览 · PNG 导出')}</p></div>
      <div className="home-art" aria-label={t('同一人物的三个手绘版本')}>
        {['Line', 'Solid', 'Color'].map((style, i) => <button key={style} className={`home-art-card home-art-card-${i}`} onClick={() => onSample(style.toLowerCase())} aria-label={`${t('体验')} ${style}`}><div className="home-art-image">{art ? <Preview image={art[i]} label={`${style} ${t('女生手绘样例')}`} /> : <div className="art-placeholder">{failed ? t('预览暂不可用') : t('正在准备样例…')}</div>}</div><span><b>{style}</b><small>{String(i + 1).padStart(2, '0')} ↗</small></span></button>)}
        <p className="home-art-caption">{t('手绘样例展示 · 上传照片自动转绘尚未开放')}</p>
      </div>
    </section>
    {draft && <section className="home-draft"><div><span className="product-kicker">{t('上次保存')}</span><h2>{t('接着完成你的头像。')}</h2><p>{new Date(draft.savedAt).toLocaleString(language === 'en' ? 'en-US' : 'zh-CN')} · {t(draft.settings.portraitFamily === 'illustration' ? '手绘样例' : '照片')}</p></div><button className="product-secondary" disabled={working} onClick={onRestore}>{t(working ? '正在恢复…' : '恢复本机草稿')}<ArrowUpRight size={16} /></button></section>}
    <section className="home-paths" aria-label={t('选择制作方式')}>
      <div className="home-section-heading"><span className="product-kicker">{t('两种开始方式')}</span><h2>{t('找到适合你的那一种。')}</h2></div>
      <article><span className="path-index">01 / PHOTO</span><h3>{t('给照片一个新色调。')}</h3><p>{t('上传自己的照片，选择原色、黑白或同色微染，调整背景与构图。')}</p><button className="product-text-action" onClick={onPhoto}>{t('先用照片样例试试')}<ArrowUpRight size={15} /></button></article>
      <article><span className="path-index">02 / ILLUSTRATION</span><h3>Line / Solid / Color</h3><p>{t('用男女两个手绘样例体验三版表达，调整服饰、腮红与唇色。')}</p><button className="product-text-action" onClick={() => onSample('line')}>{t('打开手绘工作室')}<ArrowUpRight size={15} /></button></article>
    </section>
    <section className="home-workflow"><div><span className="product-kicker">{t('从制作到使用')}</span><h2>{t('不止好看，也要合适。')}</h2><p>{t('在四种社媒主页里比较头像，再把三个版本与常用尺寸一起带走。')}</p></div><ol><li><span>01</span><b>{t('选人物与版本')}</b><p>{t('从自己的照片或手绘样例开始。')}</p></li><li><span>02</span><b>{t('配色与社媒预览')}</b><p>{t('颜色同步到 X、小红书、抖音和 Instagram。')}</p></li><li><span>03</span><b>{t('保存并下载整套')}</b><p>{t('本机草稿可恢复，头像套装一次下载。')}</p></li></ol></section>
    <section className="home-faq"><h2>{t('开始前，你可能想知道。')}</h2><div><article><h3>{t('可以把照片变成手绘吗？')}</h3><p>{t('当前开放照片配色和手绘样例编辑。上传照片自动转手绘还在准备中。')}</p></article><article><h3>{t('需要付费吗？')}</h3><p>{t('当前展示的编辑与导出功能免费体验，尚未开放付费生成。')}</p></article><article><h3>{t('照片和草稿保存在哪里？')}</h3><p>{t('照片在本机浏览器处理。只有点击保存草稿才会保存到当前浏览器；清除网站数据会清除草稿。')}</p></article><article><h3>{t('下载的文件可以直接使用吗？')}</h3><p>{t('下载方形 PNG 即可更换头像；套装包含三个版本，每版提供 1024、512、256 像素。平台可能按圆形裁切。')}</p></article></div></section>
    <footer className="home-footer"><span>tone / duo</span><p>{t('一点颜色，一点自己。')}</p><button className="product-text-action" onClick={onUpload}>{t('开始制作')}<ArrowUpRight size={16} /></button></footer>
  </main>;
}
