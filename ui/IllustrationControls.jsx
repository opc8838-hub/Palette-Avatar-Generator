/** Illustration sample/version controls and separately editable material and makeup colors. */
import { illustrationParts } from '../app/illustration-engine.js';
const makeupColors = [['红色', '#e53935'], ['灰色', '#999999'], ['淡粉', '#edb7c4'], ['蜜桃', '#e5b39e']];
function Makeup({ name, settings, onChange, t }) {
  const label = name === 'blush' ? '腮红' : '唇色';
  return <div className="illustration-makeup-group"><div className="section-heading"><span>{t(label)}</span><label><input type="checkbox" checked={settings.on} onChange={e => onChange({ ...settings, on: e.target.checked })} /> {t('开启')}</label></div>
    <div className="illustration-swatches"><button type="button" aria-pressed={!settings.on} onClick={() => onChange({ ...settings, on: false })}>{t(name === 'blush' ? '无腮红' : '无唇色')}</button>{makeupColors.map(([title, color]) => <button key={color} type="button" className="illustration-swatch swatch" style={{ '--swatch': color }} aria-label={`${t(label)} ${t(title)}`} aria-pressed={settings.on && settings.color === color} onClick={() => onChange({ ...settings, color, on: true })} />)}<input type="color" aria-label={`${t(label)} ${t('自定义颜色')}`} value={settings.color} onChange={e => onChange({ ...settings, color: e.target.value, on: true })} /></div>
    <label className="range-row"><span>{t('浓淡')}<output>{settings.on ? `${settings.strength}%` : t('未添加')}</output></span><input aria-label={`${t(label)} ${t('浓淡')}`} type="range" min="0" max="100" step="1" disabled={!settings.on} value={settings.strength} onChange={e => onChange({ ...settings, strength: Number(e.target.value) })} /></label>
  </div>;
}
export function IllustrationControls({ subject, onSubject, style, onStyle, images, Preview, makeup, onMakeup, materials, onMaterials, cards, t }) {
  const parts = illustrationParts(subject);
  return <section className="illustration-controls">
    <div className="section-heading"><span className="section-label">{t('简约手绘')}</span><span className="section-hint">{t('已确认样例')}</span></div>
    <div className="illustration-subjects" role="group" aria-label={t('手绘样例')}><button type="button" aria-pressed={subject === 'male'} onClick={() => onSubject('male')}>{t('男生')}</button><button type="button" aria-pressed={subject === 'woman'} onClick={() => onSubject('woman')}>{t('女生')}</button></div>
    <div className="mode-options" role="group" aria-label={t('手绘版本')}>{['line', 'solid', 'color'].map(id => <button key={id} type="button" className={`mode-card ${style === id ? 'selected' : ''}`} aria-pressed={style === id} onClick={() => onStyle(id)}><Preview image={images?.[id]} label={`${id[0].toUpperCase() + id.slice(1)} ${t('示例')}`} /><span className="mode-copy"><span className="mode-title">{id[0].toUpperCase() + id.slice(1)}</span></span></button>)}</div>
    <p className="illustration-help">{t(style === 'line' ? '浅灰填充，不添加腮红与唇色。' : style === 'solid' ? '深灰填充，腮红与唇色分别调整。' : '背景与服饰分别选色，头发和肤色保持原样。')}</p>
    {style !== 'line' && <div className="illustration-makeup">{['blush', 'lips'].map(name => <Makeup key={name} name={name} settings={makeup[name]} onChange={next => onMakeup({ ...makeup, [name]: next })} t={t} />)}</div>}
    {style === 'color' && parts.map(part => <div key={part.id} className="illustration-material"><div className="section-heading"><span>{t(part.label)}</span><button className="text-button" type="button" aria-pressed={!materials[part.id]} onClick={() => onMaterials({ ...materials, [part.id]: null })}>{t('保持原色')}</button></div><div className="illustration-swatches">{cards.map(card => <button key={card.id} type="button" className="illustration-swatch swatch" style={{ '--swatch': card.hex }} aria-label={`${t(part.label)} ${t(card.name)} ${card.hex}`} aria-pressed={materials[part.id] === card.hex} onClick={() => onMaterials({ ...materials, [part.id]: card.hex })} />)}<input type="color" aria-label={`${t(part.label)} ${t('自定义颜色')}`} value={materials[part.id] || '#ffffff'} onChange={e => onMaterials({ ...materials, [part.id]: e.target.value })} /></div><p className="illustration-help">{t('沿用下方当前色系，可选其他色系或保留原色。')}</p></div>)}
  </section>;
}
