// Pure text formatting shared by the local browser and server. No Node-only
// modules, storage, network access or execution of source-provided markup.
export const plain = (value, max = 2000) => typeof value === 'string'
  ? value.replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
export const markdownText = value => plain(value, 8000).replace(/([\\`*_{}\[\]()<>#+.!|~-])/g, '\\$1');
