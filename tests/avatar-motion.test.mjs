import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { MOTION_DEFAULTS, MOTION_PRESETS, motionColors, resizeMotionMask, sampleAvatarMotion, motionHtml } from '../app/avatar-motion.js';
import { translate } from '../ui/i18n.js';

test('random colors are reproducible, honor the chosen palette, and reshuffle', () => {
  const settings = { ...MOTION_DEFAULTS, colorMode: 'series' }, pool = ['#112233', '#445566', '#778899'];
  const colors = motionColors(settings, '#ffffff', pool, ['#000000']);
  assert.deepEqual(colors, motionColors(settings, '#ffffff', pool, ['#000000']));
  assert.ok(colors.every((hex) => pool.includes(hex)));
  assert.notDeepEqual(colors, motionColors({ ...settings, seed: 2 }, '#ffffff', pool, []));
  assert.ok(motionColors({ ...settings, colorMode: 'all' }, '#ffffff', pool, ['#000000']).every((hex) => hex === '#000000'));
  assert.ok(motionColors(MOTION_DEFAULTS, '#abcdef', pool, []).every((hex) => hex === '#abcdef'));
});

test('every preset animates every enabled cell continuously across a loop', () => {
  for (const [preset] of MOTION_PRESETS) for (const grid of [3, 5, 13]) {
    const settings = { ...MOTION_DEFAULTS, preset, grid, mask: Array(grid ** 2).fill(true) };
    for (let index = 0; index < grid ** 2; index++) {
      const values = Array.from({ length: 101 }, (_, frame) => sampleAvatarMotion(settings, index, frame / 100));
      assert.ok(values.every(({ opacity, light, scale }) => opacity >= 0 && opacity <= 1 && light >= 0 && light <= 1 && scale > 0));
      assert.ok(Math.max(...values.map((s) => s.light)) - Math.min(...values.map((s) => s.light)) > .2, `${preset} cell ${index} stays static`);
      assert.deepEqual(values[0], values[100]);
      assert.ok(Math.abs(values[0].light - sampleAvatarMotion(settings, index, .999999).light) < .001, `${preset} jumps at loop boundary`);
    }
  }
});

test('painted inactive cells stay excluded and resizing preserves their spatial mask', () => {
  const mask = [false, false, true, false, false, true, true, true, true];
  const expanded = resizeMotionMask(mask, 3, 9);
  assert.equal(expanded.length, 81);
  assert.equal(expanded[0], false);
  assert.equal(expanded.at(-1), true);
  assert.deepEqual(resizeMotionMask(expanded, 9, 3), mask);
  for (const appearance of ['opacity', 'scale', 'lens', 'shrink', 'pop']) {
    const value = sampleAvatarMotion({ ...MOTION_DEFAULTS, mask: Array(25).fill(false), appearance }, 0, .5);
    assert.deepEqual(value, { opacity: .18, scale: 1, light: 0 });
  }
});

test('offline export embeds safe data and renders through a self-contained script', async () => {
  const html = motionHtml({ ...MOTION_DEFAULTS, text: '</script><script>bad()</script>' }, Array(25).fill('#abcdef'), [['#abcdef', 'data:image/png;base64,AA==']]);
  assert.equal((html.match(/<script>/g) || []).length, 1);
  assert.doesNotMatch(html, /src="https?:/);
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const ctx = new Proxy({}, { get: (target, key) => target[key] || (() => {}) });
  const canvas = { getContext: () => ctx }, button = {}, frames = [];
  const sandbox = { document: { querySelector: (selector) => selector === 'canvas' ? canvas : button, addEventListener() {} }, requestAnimationFrame: (fn) => frames.push(fn), Image: class { set src(value) { this.width = 512; this.onload(); } } };
  vm.runInNewContext(script, sandbox);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(frames.length, 1);
  assert.doesNotThrow(() => frames.shift()(100));
  assert.equal(frames.length, 1);
  assert.equal(typeof button.onclick, 'function');
});

test('motion editor labels and presets are covered by English translations', () => {
  const source = readFileSync(new URL('../ui/MotionPreview.jsx', import.meta.url), 'utf8');
  const labels = [...source.matchAll(/'([^'\n]*\p{Script=Han}[^'\n]*)'/gu)].map((match) => match[1]);
  for (const label of [...labels, ...MOTION_PRESETS.map(([, name]) => name)]) assert.doesNotMatch(translate('en', label), /\p{Script=Han}/u, label);
});
