import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

// 路径常量 - 语义化命名，统一管理 monorepo 各目录绝对路径。
const EXAMPLES_ROOT = __dirname // examples 包根目录。
const EXAMPLES_SRC = resolve(EXAMPLES_ROOT, 'src') // examples 源码目录。
const REACT_DOM_SRC = resolve(EXAMPLES_ROOT, '../packages/react-dom/src') // reac-dom 源码目录。

// https://vite.dev/config/
export default defineConfig({
  // 模块解析配置。
  resolve: {
    // 路径别名。
    alias: {
      '@src': EXAMPLES_SRC,
      ReactFiberHostConfig: resolve(
        REACT_DOM_SRC,
        'client/ReactDOMHostConfig.ts'
      ),
    },
    // 自动补全文件扩展名，导入时可省略.ts/.js等后缀。
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  plugins: [react()],
})
