import {
  getPackageJSONDev,
  resolvePackagePath,
  getBaseRollupPlugins,
} from './utils.js'
import generatePackageJson from 'rollup-plugin-generate-package-json'
import dts from 'rollup-plugin-dts'

const { exports } = getPackageJSONDev('scheduler')
const { packagePathDev, packagePathBuild } = resolvePackagePath('scheduler')

export default [
  {
    input: `${packagePathDev}/${exports['.']['default']}`,
    output: {
      file: `${packagePathBuild}/umd/index.js`,
      name: 'MyMiniReactScheduler',
      format: 'umd',
      sourcemap: true,
      exports: 'auto',
      globals: {},
    },
    external: [],
    plugins: [
      ...getBaseRollupPlugins(),
      generatePackageJson({
        inputFolder: packagePathDev,
        outputFolder: packagePathBuild,
        baseContents: packageJSONObject => ({
          name: packageJSONObject.name,
          version: packageJSONObject.version,
          type: packageJSONObject.type,
          description: packageJSONObject.description,
          keywords: packageJSONObject.keywords,
          author: packageJSONObject.author,
          license: packageJSONObject.license,
          private: packageJSONObject.private,
          publishConfig: packageJSONObject.publishConfig,
          exports: {
            '.': {
              types: './esm/index.d.ts',
              import: './esm/index.js',
              require: './cjs/index.js',
              umd: './umd/index.js',
              default: './umd/index.js',
            },
          },
        }),
      }),
    ],
  },
  {
    input: `${packagePathDev}/${exports['.']['default']}`,
    output: {
      file: `${packagePathBuild}/cjs/index.js`,
      format: 'cjs',
      sourcemap: true,
      exports: 'auto',
    },
    external: [],
    plugins: getBaseRollupPlugins(),
  },
  {
    input: `${packagePathDev}/${exports['.']['import']}`,
    output: {
      file: `${packagePathBuild}/esm/index.js`,
      format: 'esm',
      sourcemap: true,
    },
    external: [],
    plugins: getBaseRollupPlugins(),
  },
  {
    input: `${packagePathDev}/${exports['.']['import']}`,
    output: {
      file: `${packagePathBuild}/esm/index.d.ts`,
      format: 'esm',
    },
    plugins: [dts({ tsconfig: `${packagePathDev}/tsconfig.json` })],
  },
]
