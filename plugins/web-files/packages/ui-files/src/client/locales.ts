/** Browser copy for the files explorer, zh and en dictionaries. */

export const zh = {
  'view.files': '文件',
  'tree.empty': '此目录为空',
  'tree.error': '加载失败',
  'tree.truncated': '条目过多，仅显示开头部分',
  'tree.loading': '加载中…',
  'viewer.loading': '加载中…',
  'viewer.empty': '选择一个文件查看内容',
  'viewer.truncated': '文件过大，仅显示开头部分',
  'viewer.preview': '预览',
  'viewer.source': '源码',
  'viewer.error.notFound': '文件不存在',
  'viewer.error.binary': '二进制文件不支持预览',
  'viewer.error.outside': '路径超出工作区范围',
  'viewer.error.other': '读取失败',
  'viewer.bytes': '字节',
} as const

export const en = {
  'view.files': 'Files',
  'tree.empty': 'This directory is empty',
  'tree.error': 'Failed to load',
  'tree.truncated': 'Too many entries; only the beginning is shown',
  'tree.loading': 'Loading…',
  'viewer.loading': 'Loading…',
  'viewer.empty': 'Select a file to view its content',
  'viewer.truncated': 'File too large; only the beginning is shown',
  'viewer.preview': 'Preview',
  'viewer.source': 'Source',
  'viewer.error.notFound': 'File not found',
  'viewer.error.binary': 'Binary files are not previewable',
  'viewer.error.outside': 'Path is outside the workspace',
  'viewer.error.other': 'Read failed',
  'viewer.bytes': 'bytes',
} as const

export type FilesLocaleKey = keyof typeof en
