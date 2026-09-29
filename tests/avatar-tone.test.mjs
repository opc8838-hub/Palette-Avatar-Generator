import test from 'node:test';
import assert from 'node:assert/strict';
import { tonePixel, recolorPixels, hexRgb } from '../app/avatar-tone.js';
import { readFile } from 'node:fs/promises';

test('neutral mode removes chroma and preserves original alpha', () => {
  const result = recolorPixels(new Uint8ClampedArray([200, 90, 25, 125]), '#F7BCDA', 'neutral', .32);
  assert.equal(result[0], result[1]); assert.equal(result[1], result[2]); assert.equal(result[3], 125);
});
test('tint changes hue without darkening face for brown backgrounds', () => {
  const rgb = tonePixel(160, 160, 160, hexRgb('#B18E7D'), 'tint', .32);
  assert.ok(rgb[0] > rgb[2]);
  assert.ok(Math.abs(.2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] - 160) < .0001);
});
test('achromatic background and extreme tones stay neutral', () => {
  assert.deepEqual(tonePixel(100, 100, 100, [197,197,197], 'tint', .8), [100,100,100]);
  assert.deepEqual(tonePixel(0,0,0,hexRgb('#F7BCDA'),'tint',.8), [0,0,0]);
  assert.ok(tonePixel(255,255,255,hexRgb('#F7BCDA'),'tint',.8).every(v => Math.abs(v - 255) < .001));
});
test('palette keeps references, curates Mindful 300, and groups distinct new colors', async () => {
  const data = JSON.parse(await readFile(new URL('../ui/palette.json', import.meta.url), 'utf8'));
  const cards = data.series.flatMap(series => [...series.cards, ...(series.ramps || []).flatMap(ramp => ramp.cards)]);
  assert.deepEqual(data.families.map(family => family.id), ['original','design','curated']);
  assert.deepEqual(data.series.map(series => series.id), ['soft','earth','goals','girlhood','curator','abyssale','mindful-300','micro-studies','daily-warm','daily-cool']);
  assert.ok(data.series.every(series => data.families.some(family => family.id === series.family)));
  assert.equal(new Set(cards.map(card => card.hex)).size, cards.length);
  assert.deepEqual(cards.filter(card => card.reference).map(card => card.hex).sort(), ['#C5E1D5','#F7BCDA']);
  assert.deepEqual(data.series.slice(0, 2).map(series => series.cards.length), [12, 6]);
  assert.ok(data.series.some(series => series.cards.some(card => card.hex === '#FF7000')));
  assert.ok(data.series.some(series => series.cards.some(card => card.hex === '#E3C8FF')));
  assert.ok(data.series.some(series => series.cards.some(card => card.hex === '#351700')));
  assert.ok(data.series.some(series => series.cards.some(card => card.hex === '#5CEBA9')));
  const mindful = data.series.find(series => series.id === 'mindful-300');
  assert.deepEqual(mindful.cards.slice(0, 6).map(card => card.hex), ['#FAF3D9','#CBF85F','#40E0D0','#8844FF','#3A18B1','#020035']);
  assert.equal(mindful.cards.length, 18);
  assert.equal(mindful.cards.filter(card => card.derived).length, 12);
  assert.deepEqual(data.series.slice(7).map(series => series.cards.length), [5, 7, 8]);
  assert.ok(data.series.slice(7).every(series => series.cards.every(card => card.sourceImage)));
  assert.equal(cards.length, 73);
  assert.ok(!data.series.some(series => series.name === '中性色'));
  assert.ok(!cards.some(card => ['#F7F6F4','#F8F3EA','#C5C5C5','#CAC3BC','#BEC5CC','#5C5E60'].includes(card.hex)));
});
