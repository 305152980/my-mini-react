import {
  getPackageJSONDev,
  resolvePackagePath,
  getBaseRollupPlugins,
} from './utils.js '
import generatePackageJson from 'rollup-plugin-generate-package-json'

const { exports } = getPackageJSONDev('react')
const { packagePathDev, packagePathBuild } = resolvePackagePath('react')

export default [
  {
    input: `${packagePathDev}/${exports['.']['default']}`,
    output: {
      file: `${packagePathBuild}/umd/index.js`,
      name: 'MyMiniReactReact',
      format: 'umd',
      sourcemap: true,
      exports: 'auto',
      globals: {}, // 当打包成 UMD 或 IIFE 格式时，告诉 Rollup 外部依赖对应的全局变量名是什么。
    },
    external: [], // 声明外部依赖。
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
]
