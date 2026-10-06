/** One explicitly saved local draft. IndexedDB keeps processed photos off the server. */
const DB = 'tone-duo-studio', STORE = 'drafts';
async function connect() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('本机草稿暂不可用，请关闭其他工作室标签页后重试。'));
  });
}
async function transaction(mode, action) {
  const db = await connect();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode), request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error || request.error);
      tx.onabort = () => reject(tx.error || Error('草稿保存被中断。'));
    });
  } finally { db.close(); }
}
export async function readDraft() {
  const draft = await transaction('readonly', store => store.get('latest'));
  if (!draft) return null;
  if (draft.version !== 1 || !draft.settings || !['photo', 'illustration'].includes(draft.settings.portraitFamily)) throw Error('此草稿版本暂不支持恢复。');
  return draft;
}
export async function writeDraft(settings, photo, thumbnail, sourceName) {
  const draft = { version: 1, savedAt: Date.now(), settings, photo, thumbnail, sourceName };
  await transaction('readwrite', store => store.put(draft, 'latest'));
  return draft;
}
export async function decodeDraftPhoto(blob, name) {
  if (!(blob instanceof Blob)) throw Error('草稿照片不完整，请重新上传。');
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return { canvas, name };
  } finally { URL.revokeObjectURL(url); }
}
