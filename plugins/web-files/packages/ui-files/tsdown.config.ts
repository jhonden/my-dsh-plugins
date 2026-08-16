/**
 * Browser client bundle for ui-files, in the same closure-factory artifact
 * shape the shipped client loads (`window.__ModuleLoader__.load({id,
 * factory})` with platform modules answered by the loader's module table).
 * The node half is plain tsc output (lib/index.js), built by `tsc -b`.
 */
import type { UserConfig } from 'tsdown'

const ID = '@gaowen/dsh-client-ui-files'

/** Loader module-table entries: shared platform identities stay external. */
const CLIENT_EXTERNALS: readonly string[] = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-runtime/client',
]

export default [
{
  // Node (Host/loader) half: the entry cordis.yml's row imports.
  name: ID,
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  fixedExtension: false,
  target: 'es2023',
  dts: false,
  sourcemap: false,
  clean: false,
},
{
  name: `${ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  external: [...CLIENT_EXTERNALS],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
} satisfies UserConfig,
] satisfies UserConfig[]
