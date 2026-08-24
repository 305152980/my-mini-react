import {
  getPackageJSONDev,
  resolvePackagePath,
  getBaseRollupPlugins,
} from './utils.js'
import generatePackageJson from 'rollup-plugin-generate-package-json'
import alias from '@rollup/plugin-alias'

const { exports } = getPackageJSONDev('react-dom')
const { packagePathDev, packagePathBuild } = resolvePackagePath('react-dom')

export default [
  {
    input: `${packagePathDev}/${exports['.']['default']}`,
    output: {
      file: `${packagePathBuild}/umd/index.js`,
      name: 'MyMiniReactReactDom',
      format: 'umd',
      sourcemap: true,
      exports: 'auto',
      globals: {
        '@my-mini-react/react': 'MyMiniReactReact',
        '@my-mini-react/scheduler': 'MyMiniReactScheduler',
      },
    },
    external: ['@my-mini-react/react', '@my-mini-react/scheduler'],
    plugins: [
      ...getBaseRollupPlugins(),
      alias({
        entries: {
          ReactFiberHostConfig: `${packagePathDev}/src/client/ReactDOMHostConfig.ts`,
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
            './client': {
              import: './esm/client.js',
              require: './cjs/client.js',
              umd: './umd/client.js',
              default: './umd/client.js',
            },
          },
          dependencies: {
            '@my-mini-react/scheduler': packageJSONObject.version,
          },
          peerDependencies: {
            '@my-mini-react/react': packageJSONObject.version,
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
    external: ['@my-mini-react/react', '@my-mini-react/scheduler'],
    plugins: [
      ...getBaseRollupPlugins(),
      alias({
        entries: {
          ReactFiberHostConfig: `${packagePathDev}/src/client/ReactDOMHostConfig.ts`,
        },
      }),
    ],
  },
  {
    input: `${packagePathDev}/${exports['.']['import']}`,
    output: {
      file: `${packagePathBuild}/esm/index.js`,
      format: 'esm',
      sourcemap: true,
    },
    external: ['@my-mini-react/react', '@my-mini-react/scheduler'],
    plugins: [
      ...getBaseRollupPlugins(),
      alias({
        entries: {
          ReactFiberHostConfig: `${packagePathDev}/src/client/ReactDOMHostConfig.ts`,
        },
      }),
    ],
  },
  {
    input: `${packagePathDev}/${exports['./client']['default']}`,
    output: [
      {
        file: `${packagePathBuild}/umd/client.js`,
        name: 'MyMiniReactReactDomClient',
        format: 'umd',
        sourcemap: true,
        exports: 'auto',
        globals: {
          '@my-mini-react/react': 'MyMiniReactReact',
          '@my-mini-react/scheduler': 'MyMiniReactScheduler',
        },
      },
    ],
    external: ['@my-mini-react/react', '@my-mini-react/scheduler'],
    plugins: [
      ...getBaseRollupPlugins(),
      alias({
        entries: {
          ReactFiberHostConfig: `${packagePathDev}/src/client/ReactDOMHostConfig.ts`,
        },
      }),
    ],
  },
  {
    input: `${packagePathDev}/${exports['./client']['default']}`,
    output: {
      file: `${packagePathBuild}/cjs/client.js`,
      format: 'cjs',
      sourcemap: true,
      exports: 'auto',
    },
    external: ['@my-mini-react/react', '@my-mini-react/scheduler'],
    plugins: [
      ...getBaseRollupPlugins(),
      alias({
        entries: {
          ReactFiberHostConfig: `${packagePathDev}/src/client/ReactDOMHostConfig.ts`,
        },
      }),
    ],
  },
  {
    input: `${packagePathDev}/${exports['./client']['import']}`,
    output: {
      file: `${packagePathBuild}/esm/client.js`,
      format: 'esm',
      sourcemap: true,
    },
    external: ['@my-mini-react/react', '@my-mini-react/scheduler'],
    plugins: [
      ...getBaseRollupPlugins(),
      alias({
        entries: {
          ReactFiberHostConfig: `${packagePathDev}/src/client/ReactDOMHostConfig.ts`,
        },
      }),
    ],
  },
]
