import fs from 'fs'

const reactDomPackageJSONPath =
  'dist/node_modules/@my-mini-react/react-dom/package.json'
const reactDomPackageJSON = JSON.parse(
  fs.readFileSync(reactDomPackageJSONPath, 'utf-8')
)
const schedulerPackageJSONPath =
  'dist/node_modules/@my-mini-react/scheduler/package.json'
const schedulerPackageJSON = JSON.parse(
  fs.readFileSync(schedulerPackageJSONPath, 'utf-8')
)

reactDomPackageJSON.dependencies = {
  '@my-mini-react/scheduler': schedulerPackageJSON.version,
}

fs.writeFileSync(
  reactDomPackageJSONPath,
  JSON.stringify(reactDomPackageJSON, null, 2)
)
