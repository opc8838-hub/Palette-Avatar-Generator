/** Saved looks belong to one portrait; editing and download choices stay independent. */
export const LOOK_LIMIT = 5;
export function lookSignature(settings) {
  const illustration = settings.portraitFamily === 'illustration';
  const version = illustration ? settings.illustrationStyle : settings.mode;
  const material = settings.illustrationMaterials?.[settings.illustrationSubject] || {};
  const makeup = part => part?.on && part.strength > 0 ? [part.color.toLowerCase(), part.strength] : [false];
  return JSON.stringify([
    settings.portraitFamily, illustration ? settings.illustrationSubject : settings.photoId,
    version, illustration && version !== 'color' ? '#ffffff' : settings.color.toLowerCase(),
    illustration ? version === 'color' ? Object.entries(material).map(([key, value]) => [key, value.toLowerCase()]).sort(([a], [b]) => a.localeCompare(b)) : null : version === 'tint' ? settings.strength : null,
    illustration && version !== 'line' ? [makeup(settings.makeup.blush), makeup(settings.makeup.lips)] : null,
    settings.zoom, settings.x, settings.y, settings.textLayer?.text ? settings.textLayer : null,
  ]);
}
export function addSavedLook(items, { id, settings, thumbnail, createdAt }) {
  const signature = lookSignature(settings);
  if (items.some(item => lookSignature(item.settings) === signature)) throw Error('这套配色已经收藏，可继续调色后再保存。');
  if (items.length >= LOOK_LIMIT) throw Error('已保存 5 套配色，删除一套后可以继续收藏。');
  return [...items, { id, name: '', settings: structuredClone(settings), thumbnail, createdAt }];
}
export function selectedLooks(items, selectedIds) {
  return items.filter(item => selectedIds.includes(item.id));
}
