import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { translate, textPresets } from '../ui/i18n.js';

const palette = JSON.parse(readFileSync(new URL('../ui/palette.json', import.meta.url), 'utf8'));

test('English palette covers every visible family, series, and color label', () => {
  const labels = [
    ...palette.families.map((family) => family.name),
    ...palette.series.flatMap((series) => [
      series.name, series.subtitle, series.source,
      ...series.cards.map((card) => card.name),
      ...(series.ramps || []).flatMap((ramp) => ramp.cards.map((card) => card.name)),
    ]),
  ].filter(Boolean);
  for (const label of labels) assert.doesNotMatch(translate('en', label), /\p{Script=Han}/u, `Untranslated: ${label}`);
  assert.equal(translate('zh', '樱粉'), '樱粉');
  assert.equal(translate('en', '奶油白 · 04'), 'Cream · 04');
});

test('sample text options follow the selected language', () => {
  assert.ok(textPresets.zh.includes('做自己'));
  assert.ok(textPresets.en.includes('BE YOURSELF'));
  assert.equal(textPresets.zh.length, textPresets.en.length);
});
