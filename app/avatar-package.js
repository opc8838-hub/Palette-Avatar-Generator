/** Portable, uncompressed ZIP exports. PNG files already carry their own compression. */
const encoder = new TextEncoder();
const table = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function createZip(entries) {
  const chunks = [], directory = []; let offset = 0, directorySize = 0;
  for (const entry of entries) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(entry.name)) throw Error('Invalid archive filename');
    const name = encoder.encode(entry.name), bytes = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
    const crc = crc32(bytes), header = new Uint8Array(30 + name.length), view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true);
    view.setUint16(12, 33, true); view.setUint32(14, crc, true); view.setUint32(18, bytes.length, true); view.setUint32(22, bytes.length, true); view.setUint16(26, name.length, true); header.set(name, 30);
    const central = new Uint8Array(46 + name.length), record = new DataView(central.buffer);
    record.setUint32(0, 0x02014b50, true); record.setUint16(4, 20, true); record.setUint16(6, 20, true); record.setUint16(8, 0x800, true);
    record.setUint16(14, 33, true); record.setUint32(16, crc, true); record.setUint32(20, bytes.length, true); record.setUint32(24, bytes.length, true); record.setUint16(28, name.length, true); record.setUint32(42, offset, true); central.set(name, 46);
    chunks.push(header, bytes); directory.push(central); offset += header.length + bytes.length; directorySize += central.length;
  }
  const end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, entries.length, true); view.setUint16(10, entries.length, true); view.setUint32(12, directorySize, true); view.setUint32(16, offset, true);
  return new Blob([...chunks, ...directory, end], { type: 'application/zip' });
}
export function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('图片导出失败，请重试。')), 'image/png'));
}
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function exportAvatarPackage(versions, settings) {
  const entries = [];
  for (const { name, canvas } of versions) {
    for (const size of [1024, 512, 256]) {
      const output = document.createElement('canvas'); output.width = output.height = size;
      const ctx = output.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(canvas, 0, 0, size, size);
      entries.push({ name: `${name}-${size}.png`, data: new Uint8Array(await (await canvasBlob(output)).arrayBuffer()) });
    }
  }
  entries.push({ name: 'palette.json', data: JSON.stringify({ product: 'Tone Duo', version: 1, settings }, null, 2) });
  entries.push({ name: 'README.txt', data: `Tone Duo — Avatar set\n\n${versions.map(v => v.name).join(' / ')}\nEach version: 1024, 512 and 256 px, square PNG.\n\nUse the square image as your profile avatar. Social platforms may crop it into a circle.\nPalette settings are included for reference. They are not a restorable project file.\n${settings.portraitFamily === 'illustration' ? 'This set uses a demonstration portrait, not a conversion of an uploaded photo.' : 'This set was composed locally from your photo.'}\n` });
  downloadBlob(createZip(entries), `tone-duo-${settings.portraitFamily}-set.zip`);
}
