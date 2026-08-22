import path from 'path'
import fs from 'fs'
import typescript2 from 'rollup-plugin-typescript2'
import commonjs from '@rollup/plugin-commonjs'
import replace from '@rollup/plugin-replace'
import resolve from '@rollup/plugin-node-resolve'

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
  { aliasParams = { preventAssignment: true }, typescript2Params = {} } = {
    aliasParams: { preventAssignment: true },
    typescript2Params: {},
  }
) {
  return [
    resolve({ preferBuiltins: false }),
    replace(aliasParams),
    commonjs(),
    typescript2(typescript2Params),
  ]
}
