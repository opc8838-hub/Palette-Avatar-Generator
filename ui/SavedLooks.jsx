/** Portrait-specific favorites: restore a look, rename it, or choose it for delivery. */
import { BookmarkPlus, Trash2, Download } from 'lucide-react';
export function SavedLooks({ items, selectedIds, onSelect, onSave, onRestore, onDelete, onRename, onDownload, busy, available, t, expanded = false, currentSignature, signatureOf }) {
  const content = <>
    <p className="saved-looks-help">{t('最多收藏 5 套。保存背景、服饰、妆色、构图与文字，可恢复后继续调色。')}</p>
    <button className="product-secondary look-save" onClick={onSave} disabled={!available || busy || items.length >= 5}><BookmarkPlus size={15} />{t(busy ? '正在保存配色…' : '收藏当前配色')}<span>{items.length} / 5</span></button>
    {items.length === 0 ? <p className="saved-looks-empty">{t('先收藏一套喜欢的配色，再试试其他颜色。')}</p> : <ul className="saved-looks-list">{items.map((item, i) => {
      const label = item.name || `${t('配色')} ${i + 1}`, active = signatureOf(item.settings) === currentSignature;
      return <li key={item.id} className={active ? 'is-current' : ''}>
        {expanded && <label className="look-select"><input type="checkbox" checked={selectedIds.includes(item.id)} disabled={busy} onChange={e => onSelect(item.id, e.target.checked)} aria-label={`${t('打包包含')} ${label}`} /></label>}
        <button className="look-thumbnail" onClick={() => onRestore(item)} disabled={busy || !available} aria-label={`${t('恢复配色')} ${label}`} aria-pressed={active}><img src={item.thumbnail} alt={`${label} ${t('头像预览')}`} /></button>
        <div className="look-details"><input key={item.name} defaultValue={item.name} placeholder={`${t('配色')} ${i + 1}`} aria-label={`${t('配色名称')} ${i + 1}`} maxLength={32} disabled={busy} onBlur={e => { const name = e.target.value.trim(); if (name !== item.name) onRename(item.id, name); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /><button className="product-text-action" onClick={() => onRestore(item)} disabled={busy || !available}>{t(active ? '当前配色' : '恢复并继续编辑')}</button></div>
        <div className="look-actions">{expanded && <button onClick={() => onDownload(item)} disabled={busy || !available} aria-label={`${t('下载配色')} ${label}`} title={t('下载此配色的当前版本')}><Download size={14} /></button>}<button onClick={() => onDelete(item.id)} disabled={busy} aria-label={`${t('删除配色')} ${label}`}><Trash2 size={14} /></button></div>
      </li>;
    })}</ul>}
    <p className="saved-looks-local">{t('仅存于当前浏览器。收藏时同时更新本机草稿；清除网站数据会清除收藏。')}</p>
  </>;
  return expanded ? <section className="saved-looks"><div className="saved-looks-heading"><h3>{t('收藏的配色')}</h3><span>{items.length} / 5</span></div>{content}</section> : <details className="saved-looks saved-looks-compact"><summary>{t('收藏的配色')}<span>{items.length} / 5</span></summary>{content}</details>;
}
