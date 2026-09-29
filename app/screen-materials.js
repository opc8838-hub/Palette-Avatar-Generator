/**
 * [INPUT]: 依赖设备 glTF 的内外屏节点命名、外屏摄像头开孔几何与 wallpaper renderer 的屏幕纹理/投影接口。
 * [OUTPUT]: 提供 installDynamicScreens，补齐外屏摄像头开孔并将离屏结果注入模型的物理屏幕材质。
 * [POS]: app 的模型适配层；把资源内部命名和外屏几何修补隔离在单点。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import * as THREE from '../assets/three.module.min.js?v=165';

const SCREEN_MODES = new Map([
  ['skeleton_0_3_screenTexture_geo', 'inner'],
  ['skeleton_0_7_outerDisplayScreenTexture_geo', 'outer'],
]);

// Small lens stack on the outer display; the portrait preview uses an uninterrupted image.
const OUTER_DISPLAY_CAMERA_PARTS = new Set([
  'ehFPMznSGbmsGvH',
  'vCDzJvgfRHxZtCX',
  'ngETxiQNpkmnIgB',
  'CDcRBIEJOCUrJBF',
]);

function fillOuterCameraAperture(screen) {
  if (screen.userData.cameraApertureFilled) return;

  const source = screen.geometry;
  const positions = source.getAttribute('position');
  const sourceIndices = source.getIndex();
  const edges = new Map();
  const addEdge = (a, b) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const edge = edges.get(key);
    if (edge) edge.count += 1;
    else edges.set(key, { a, b, count: 1 });
  };

  for (let i = 0; i < sourceIndices.count; i += 3) {
    const a = sourceIndices.getX(i);
    const b = sourceIndices.getX(i + 1);
    const c = sourceIndices.getX(i + 2);
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  }

  // This fixed glTF has a circular 40-edge opening in its outer display.
  const nearAperture = (index) => Math.hypot(
    positions.getX(index) + 7.17348,
    positions.getZ(index) + 4.80339,
  ) < 0.34;
  const opening = [...edges.values()].filter(({ a, b, count }) =>
    count === 1 && nearAperture(a) && nearAperture(b));
  if (opening.length !== 40) {
    console.warn('Outer display camera opening could not be filled:', opening.length);
    return;
  }

  const ring = [...new Set(opening.flatMap(({ a, b }) => [a, b]))];
  const center = positions.count;
  const geometry = source.clone();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const expanded = new attribute.array.constructor(attribute.array.length + attribute.itemSize);
    expanded.set(attribute.array);
    for (let component = 0; component < attribute.itemSize; component += 1) {
      const read = ['getX', 'getY', 'getZ', 'getW'][component];
      const value = name === 'skinIndex'
        ? attribute[read](ring[0])
        : ring.reduce((sum, index) => sum + attribute[read](index), 0) / ring.length;
      expanded[attribute.array.length + component] = value;
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(expanded, attribute.itemSize, attribute.normalized));
  }

  const indices = new sourceIndices.array.constructor(sourceIndices.count + opening.length * 3);
  indices.set(sourceIndices.array);
  opening.forEach(({ a, b }, i) => {
    // Reverse the existing boundary edge so each new triangle faces outwards.
    indices.set([b, a, center], sourceIndices.count + i * 3);
  });
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  screen.geometry = geometry;
  screen.userData.cameraApertureFilled = true;
}

export function installDynamicScreens(root, dynamicWallpaper) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    if (OUTER_DISPLAY_CAMERA_PARTS.has(node.name)) { node.visible = false; return; }
    const mode = SCREEN_MODES.get(node.name);
    if (!mode) return;
    if (mode === 'outer') fillOuterCameraAperture(node);
    const material = Array.isArray(node.material) ? node.material[0] : node.material;
    if (!material) return;
    // 屏幕只接受离屏渲染结果；加载期间保持未点亮，避免闪现资源里的旧截图。
    material.map = null;
    material.emissiveMap = dynamicWallpaper?.getTexture(mode) ?? null;
    material.color.set(0x000000);
    material.emissive.set(0xffffff);
    material.emissiveIntensity = dynamicWallpaper ? 1 : 0;
    material.metalness = 0;
    material.roughness = mode === 'inner' ? .33 : .05;
    material.toneMapped = false;
    material.dithering = true;
    dynamicWallpaper?.installScreen(node, mode);
    material.needsUpdate = true;
  });
}
