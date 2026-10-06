/** Four local social profile mockups with crisp marks and a shared live avatar. */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { ArrowLeft, BatteryFull, Bell, Bookmark, Grid3X3, Heart, Home, Menu, MessageCircle, MoreHorizontal, Plus, Search, Signal, UserRound, Video, Wifi } from 'lucide-react';
import { translate } from './i18n.js';

const socialAsset = (name) => `${import.meta.env.BASE_URL}assets/social/${name}.svg`;

function Avatar({ image, label, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.width = image?.width || 240;
    element.height = image?.height || 240;
    const context = element.getContext('2d');
    context.clearRect(0, 0, element.width, element.height);
    if (image) context.drawImage(image, 0, 0);
  }, [image]);
  return <canvas ref={ref} className={`social-avatar ${className}`} role="img" aria-label={label} />;
}

function Phone({ name, id, children, t }) {
  const frameRef = useRef(null);
  const viewportRef = useRef(null);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const viewport = viewportRef.current;
    if (!frame || !viewport) return;
    const updateScale = () => {
      frame.style.setProperty('--phone-scale', String(viewport.getBoundingClientRect().width / 206));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  return <article ref={frameRef} className={`social-phone social-phone--${id}`} aria-label={`${name} ${t('账号界面预览')}`}>
    <div ref={viewportRef} className="social-phone-viewport">
    <div className="social-phone-screen">
      <div className="social-phone-island" aria-hidden="true" />
      <div className="social-phone-status"><span>9:41</span><span className="social-signal" aria-hidden="true"><Signal size={10} strokeWidth={2.5} /><Wifi size={10} strokeWidth={2.5} /><BatteryFull size={12} strokeWidth={2.5} /></span></div>
      {children}
      <div className="social-home-indicator" aria-hidden="true" />
    </div>
    </div>
  </article>;
}

function XProfile({ image, t }) {
  return <Phone id="x" name="X" t={t}>
    <div className="social-app-bar"><ArrowLeft size={15} /><img className="social-brand-logo social-brand-x" src={socialAsset('x')} alt="X" /><MoreHorizontal size={15} /></div>
    <div className="social-x-cover" />
    <div className="social-x-identity"><Avatar image={image} label={`X ${t('头像')}`} /><span className="social-mini-button">{t('编辑资料')}</span></div>
    <div className="social-profile-copy"><strong>{t('我的色彩')}</strong><span>@mycolor</span><p>{t('给每天的自己，一点新的颜色。')}</p><small><b>128</b> {t('关注')}　 <b>1,284</b> {t('关注者')}</small></div>
    <div className="social-profile-tabs"><b>{t('帖子')}</b><span>{t('回复')}</span><span>{t('媒体')}</span><span>{t('喜欢')}</span></div>
    <div className="social-x-post"><Avatar image={image} label={`X ${t('动态头像')}`} /><div><b>{t('我的色彩')} <small>@mycolor · {t('刚刚')}</small></b><p>{t('今天换了一个新头像 ✳')}</p><div className="social-post-actions"><MessageCircle size={10} /><Heart size={10} /><Bookmark size={10} /></div></div></div>
    <div className="social-x-nav"><Home size={15} /><Search size={15} /><Bell size={15} /><UserRound size={15} /></div>
  </Phone>;
}

function XiaohongshuProfile({ image, t, language }) {
  return <Phone id="xiaohongshu" name={t('小红书')} t={t}>
    <div className="social-app-bar social-xhs-bar"><Menu size={14} />{language === 'zh' ? <img className="social-brand-logo social-brand-xhs" src={socialAsset('xiaohongshu')} alt="小红书" /> : <strong className="social-brand-rednote">REDnote</strong>}<MoreHorizontal size={15} /></div>
    <div className="social-xhs-search"><Search size={10} /> {t('搜索笔记、用户')}</div>
    <div className="social-xhs-profile"><Avatar image={image} label={`${t('小红书')} ${t('头像')}`} /><div><strong>{t('我的色彩')}</strong><span>{t('小红书号：')}mycolor</span><p>{t('用颜色记录每一种心情。')}</p></div></div>
    <div className="social-xhs-stats"><span><b>36</b>{t('关注')}</span><span><b>{language === 'zh' ? '1.2万' : '12K'}</b>{t('粉丝')}</span><span><b>{language === 'zh' ? '8.6万' : '86K'}</b>{t('获赞与收藏')}</span></div>
    <div className="social-xhs-actions"><span className="social-mini-button">{t('编辑资料')}</span><span>{t('分享主页')}</span></div>
    <div className="social-profile-tabs"><b>{t('笔记')}</b><span>{t('收藏')}</span><span>{t('赞过')}</span></div>
    <div className="social-xhs-notes"><div className="social-note-card"><Avatar image={image} label={`${t('小红书')} ${t('笔记头像')}`} /><span>{t('今天的头像颜色')}</span></div><div className="social-note-card social-note-color"><span>{t('我的灵感色卡')}</span></div></div>
    <div className="social-xhs-nav"><Home size={14} /><Search size={14} /><span className="social-nav-plus">＋</span><Heart size={14} /><UserRound size={14} /></div>
  </Phone>;
}

function DouyinProfile({ image, t, language }) {
  return <Phone id="douyin" name={t('抖音')} t={t}>
    <div className="social-app-bar social-douyin-bar"><Menu size={14} /><span className="social-douyin-brand"><img src={socialAsset('tiktok')} alt="" /><strong>{t('抖音')}</strong></span><MoreHorizontal size={15} /></div>
    <div className="social-douyin-profile"><Avatar image={image} label={`${t('抖音')} ${t('头像')}`} /><strong>{t('我的色彩')}</strong><span>{t('抖音号：')}mycolor</span><p>{t('把喜欢的颜色，留给今天的自己。')}</p></div>
    <div className="social-douyin-stats"><span><b>128</b> {t('关注')}</span><span><b>{language === 'zh' ? '2.3万' : '23K'}</b> {t('粉丝')}</span><span><b>{language === 'zh' ? '12万' : '120K'}</b> {t('获赞')}</span></div>
    <div className="social-douyin-actions"><span className="social-mini-button">{t('编辑资料')}</span><span>＋ {t('朋友')}</span></div>
    <div className="social-profile-tabs"><b>{t('作品')}</b><span>{t('喜欢')}</span><span>{t('收藏')}</span></div>
    <div className="social-douyin-videos"><div className="social-video-cover"><Avatar image={image} label={`${t('抖音')} ${t('作品头像')}`} /><Video size={13} /></div><div className="social-video-cover social-video-color"><Heart size={15} /></div><div className="social-video-cover social-video-light"><Plus size={15} /></div></div>
    <div className="social-douyin-nav"><Home size={14} /><Search size={14} /><span className="social-nav-plus">＋</span><MessageCircle size={14} /><UserRound size={14} /></div>
  </Phone>;
}

function InstagramProfile({ image, t, language }) {
  return <Phone id="instagram" name="Instagram" t={t}>
    <div className="social-app-bar social-instagram-bar"><span className="social-instagram-brand"><img src={socialAsset('instagram')} alt="Instagram" /><strong>mycolor</strong></span><MoreHorizontal size={16} /></div>
    <div className="social-ig-profile"><Avatar image={image} label={`Instagram ${t('头像')}`} /><div className="social-ig-stats"><span><b>24</b>{t('帖子')}</span><span><b>1,284</b>{t('粉丝')}</span><span><b>182</b>{t('关注')}</span></div></div>
    <div className="social-ig-bio"><strong>{t('我的色彩')}</strong><span>{t('色彩笔记 · 人像与配色')}</span><p>{t('找到你的专属颜色 ✳')}</p></div>
    <div className="social-ig-actions"><span className="social-mini-button">{t('编辑资料')}</span><span className="social-mini-button">{t('分享主页')}</span></div>
    <div className="social-ig-stories"><span><i className="social-story-dot" />{t('颜色')}</span><span><i className="social-story-dot social-story-alt" />{t('日常')}</span><span><i className="social-story-dot social-story-third" />{t('心情')}</span></div>
    <div className="social-profile-tabs social-ig-tabs"><Grid3X3 size={13} /><Video size={13} /><Bookmark size={13} /></div>
    <div className="social-ig-grid"><Avatar image={image} label={`Instagram ${t('帖子头像')}`} /><span /><span /></div>
    <div className="social-ig-nav"><Home size={14} /><Search size={14} /><Plus size={14} /><Heart size={14} /><Avatar image={image} label={`Instagram ${t('底部头像')}`} /></div>
  </Phone>;
}

export function SocialPreview({ image, color, colorName, language = 'zh' }) {
  const t = (text) => translate(language, text);
  return <section className="social-preview" style={{ '--social-color': color }} aria-label={t('社媒头像对比')}>
    <div className="social-preview-heading"><div><span className="social-preview-kicker">SOCIAL AVATAR PREVIEW</span><h2>{t('一张头像，放进四个主页。')}</h2></div><p><i style={{ background: color }} />{t(colorName || '当前颜色')} · {t('模拟界面')}</p></div>
    <div className="social-phone-grid"><XProfile image={image} t={t} /><XiaohongshuProfile image={image} t={t} language={language} /><DouyinProfile image={image} t={t} language={language} /><InstagramProfile image={image} t={t} language={language} /></div>
  </section>;
}
