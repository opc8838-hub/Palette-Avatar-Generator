import test from 'node:test';
import assert from 'node:assert/strict';
import { addSavedLook, lookSignature, selectedLooks } from '../app/saved-looks.js';
import { exportSavedLooks, crc32 } from '../app/avatar-package.js';
const settings = { portraitFamily: 'illustration', illustrationSubject: 'woman', illustrationStyle: 'color', color: '#C0D9F0', illustrationMaterials: { woman: { clothing: '#F9D3AF' }, male: {} }, makeup: { blush: { on: false, color: '#e53935', strength: 20 }, lips: { on: true, color: '#e53935', strength: 35 } }, zoom: 1, x: 0, y: 0, textLayer: { text: '', font: 'display', color: '#111111', size: 128 } };
test('a favorite freezes its settings; irrelevant edits cannot fill slots with duplicates', () => {
  const s = structuredClone(settings);
  const items = addSavedLook([], { id: 'first', settings: s, thumbnail: 'data:image/png;base64,', createdAt: 1 });
  s.color = '#ff0000'; assert.equal(items[0].settings.color, '#C0D9F0');
  const other = structuredClone(settings); other.exportSize = 256; other.seriesId = 'different'; other.makeup.blush.color = '#999999'; other.illustrationMaterials.male.clothing = '#888888';
  assert.equal(lookSignature(other), lookSignature(settings));
  assert.throws(() => addSavedLook(items, { id: 'second', settings: other }), /已经收藏/);
  const lineA = { ...settings, illustrationStyle: 'line' }, lineB = { ...other, illustrationStyle: 'line', color: '#000000', makeup: { ...other.makeup, lips: { on: false } } };
  assert.equal(lookSignature(lineA), lookSignature(lineB));
});
test('five-look limit does not limit repeat downloads, and export contains only selected IDs', () => {
  let items = [];
  for (let i = 0; i < 5; i++) items = addSavedLook(items, { id: String(i), settings: { ...settings, color: '#00000' + i } });
  assert.throws(() => addSavedLook(items, { id: 'six', settings: { ...settings, color: '#ffffff' } }), /5 套/);
  assert.deepEqual(selectedLooks(items, ['1', '3', 'missing']).map(item => item.id), ['1', '3']);
  assert.equal(selectedLooks(items, ['1']).length, 1); assert.equal(selectedLooks(items, []).length, 0);
});
test('favorite ZIP uses saved settings, distinct filenames and correct sizes for checked looks only', async () => {
  const priorDocument = globalThis.document, priorSetTimeout = globalThis.setTimeout;
  let zipBlob, downloadName;
  const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  globalThis.document = { createElement(type) {
    if (type === 'a') return { click() { downloadName = this.download; } };
    return { width: 0, height: 0, source: null, getContext() { return { drawImage: source => { this.source = source; } }; }, toBlob(callback) { callback(new Blob([JSON.stringify({ size: this.width, color: this.source.color, version: this.source.version })])); } };
  } };
  URL.createObjectURL = blob => { zipBlob = blob; return 'blob:test'; }; URL.revokeObjectURL = () => {};
  globalThis.setTimeout = action => { action(); return 0; };
  try {
    const chosen = selectedLooks([{ id: 'blue', settings: { color: 'blue' } }, { id: 'red', settings: { color: 'red' } }, { id: 'green', settings: { color: 'green' } }], ['blue', 'green']);
    await exportSavedLooks(chosen, async s => ['line', 'solid', 'color'].map(version => ({ name: version, canvas: { color: s.color, version } })));
    assert.equal(downloadName, 'tone-duo-saved-looks.zip');
    const bytes = new Uint8Array(await zipBlob.arrayBuffer()), view = new DataView(bytes.buffer), entries = [];
    let offset = 0;
    while (view.getUint32(offset, true) === 0x04034b50) {
      const size = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true), dataOffset = offset + 30 + nameLength;
      const data = bytes.slice(dataOffset, dataOffset + size);
      assert.equal(crc32(data), view.getUint32(offset + 14, true));
      entries.push({ name: new TextDecoder().decode(bytes.slice(offset + 30, dataOffset)), data }); offset = dataOffset + size;
    }
    assert.equal(entries.length, 20); assert.equal(new Set(entries.map(e => e.name)).size, 20);
    for (const entry of entries.filter(e => e.name.endsWith('.png'))) {
      const output = JSON.parse(new TextDecoder().decode(entry.data));
      assert.ok(['blue', 'green'].includes(output.color));
      assert.ok(entry.name.endsWith(`-${output.size}.png`)); assert.ok([256, 512, 1024].includes(output.size));
    }
    const manifest = JSON.parse(new TextDecoder().decode(entries.find(e => e.name === 'palette.json').data));
    assert.deepEqual(manifest.looks.map(look => look.id), ['blue', 'green']);
    assert.ok(manifest.looks.every(look => look.files.length === 9));
    assert.equal(view.getUint32(offset, true), 0x02014b50);
    assert.equal(view.getUint16(bytes.length - 12, true), 20);
  } finally { globalThis.document = priorDocument; globalThis.setTimeout = priorSetTimeout; URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke; }
});
