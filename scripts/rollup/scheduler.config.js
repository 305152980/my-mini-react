import {
  getPackageJSONDev,
  resolvePackagePath,
  getBaseRollupPlugins,
} from './utils'
import generatePackageJson from 'rollup-plugin-generate-package-json'

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
      ...getBaseRollupPlugins({
        typescript2Params: {
          tsconfig: `${packagePathDev}/tsconfig.json`,
        },
      }),
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
    plugins: getBaseRollupPlugins({
      typescript2Params: {
        tsconfig: `${packagePathDev}/tsconfig.json`,
      },
    }),
  },
  {
    input: `${packagePathDev}/${exports['.']['import']}`,
    output: {
      file: `${packagePathBuild}/esm/index.js`,
      format: 'esm',
      sourcemap: true,
    },
    external: [],
    plugins: getBaseRollupPlugins({
      typescript2Params: {
        tsconfig: `${packagePathDev}/tsconfig.json`,
      },
    }),
  },
]
