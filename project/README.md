# project

## 使用步骤

### 步骤 1

在 `project/package.json` 中添加 `pnpm.overrides`，将本地构建的包指向 `dist` 目录：

```json
"pnpm": {
  "overrides": {
    "@my-mini-react/react": "file:../dist/node_modules/@my-mini-react/react",
    "@my-mini-react/react-dom": "file:../dist/node_modules/@my-mini-react/react-dom",
    "@my-mini-react/scheduler": "file:../dist/node_modules/@my-mini-react/scheduler"
  }
}
```

### 步骤 2

在根目录下执行，安装依赖：

```bash
pnpm --dir project install --ignore-workspace
```

### 步骤 3

在根目录下执行，启动项目：

```bash
pnpm --dir project dev
```
