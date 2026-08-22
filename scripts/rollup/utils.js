import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import resolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import commonjs from '@rollup/plugin-commonjs'
import esbuild from 'rollup-plugin-esbuild'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const packageParentPathDev = path.resolve(__dirname, '../../packages')
const packageParentPathBuild = path.resolve(
  __dirname,
  '../../dist/node_modules'
)

export function getPackageJSONDev(packageFolderNameDev) {
  const packageJSONFilePathDev = `${packageParentPathDev}/${packageFolderNameDev}/package.json`
  const packageJSONFileStrDev = fs.readFileSync(packageJSONFilePathDev, {
    encoding: 'utf-8',
  })
  return JSON.parse(packageJSONFileStrDev)
}

export function resolvePackagePath(packageFolderNameDev) {
  const { name } = getPackageJSONDev(packageFolderNameDev)
  return {
    packagePathDev: `${packageParentPathDev}/${packageFolderNameDev}`,
    packagePathBuild: `${packageParentPathBuild}/${name}`,
  }
}

export function getBaseRollupPlugins(
  {
    aliasParams = { preventAssignment: true },
    esbuildParams = { include: /\.[tj]s$/ },
  } = {
    aliasParams: { preventAssignment: true },
    esbuildParams: { include: /\.[tj]s$/ },
  }
) {
  return [
    resolve({ preferBuiltins: false }),
    replace(aliasParams),
    commonjs(),
    esbuild(esbuildParams),
  ]
}
