/** Export options describe the actual PNG package and the explicitly saved local draft. */
import { Download, FolderArchive, Save } from 'lucide-react';
export function DeliveryPanel({ illustration, currentImage, Preview, size, onSize, onSave, onPackage, onDraft, onEdit, savedLooks, onCollection, selectedCount, exporting, draftBusy, draftSavedAt, available, t }) {
  return <section className="delivery-panel" aria-label={t('头像交付')}>
    <div className="delivery-heading"><span className="product-kicker">YOUR AVATAR SET</span><h2>{t('一个头像，更多配色。')}</h2><p>{t('当前免费体验。同一头像可以继续调色、反复下载。')}</p></div>
    <div className="delivery-preview"><Preview image={currentImage} label={t('下载预览')} /><div><b>{illustration ? 'Line / Solid / Color' : t('原色 / 黑白 / 微染')}</b><p>{t('当前配色、构图与文字都会保留。')}</p></div></div>
    <label className="delivery-size">{t('单张下载尺寸')}<select value={size} onChange={e => onSize(Number(e.target.value))}>{[1024, 512, 256].map(n => <option key={n} value={n}>{n} × {n} px</option>)}</select></label>
    <button className="product-secondary" onClick={onSave} disabled={!available || exporting}><Download size={16} />{t('下载当前配色')} · PNG</button>
    <button className="product-text-action delivery-edit" onClick={onEdit} disabled={exporting}>{t('继续调色')} ↗</button>
    <div className="delivery-bundle"><h3>{t('当前配色，三个版本。')}</h3><p>{t('每版 3 个尺寸，共 9 张 PNG，附配色记录。')}</p><button className="product-primary" onClick={onPackage} disabled={!available || exporting}><FolderArchive size={17} />{t(exporting ? '正在打包…' : '下载当前配色整套')}<span>ZIP ↓</span></button></div>
    {savedLooks}
    <div className="delivery-collection"><p>{t('只打包勾选的收藏，每套配色包含 9 张 PNG。')}</p><button className="product-primary" onClick={onCollection} disabled={!available || exporting || !selectedCount}><FolderArchive size={17} />{t(exporting ? '正在打包…' : '打包下载收藏')}<span>{selectedCount} {t('套')} · ZIP ↓</span></button></div>
    <div className="delivery-draft"><button className="product-text-action" onClick={onDraft} disabled={!available || draftBusy}><Save size={15} />{t(draftBusy ? '正在保存草稿…' : draftSavedAt ? '更新本机草稿' : '保存本机草稿')}</button><p>{t('保留当前人物和编辑设置，下次从首页继续。仅保存最近一份，更新会替换原草稿。')}</p></div>
  </section>;
}
