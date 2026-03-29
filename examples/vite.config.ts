import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

// 路径常量 - 语义化命名，统一管理monorepo各目录绝对路径
const EXAMPLES_ROOT = __dirname // examples包根目录
const EXAMPLES_SRC = resolve(EXAMPLES_ROOT, 'src') // examples源码目录

// https://vite.dev/config/
export default defineConfig({
  // 模块解析配置
  resolve: {
    // 路径别名
    alias: {
      '@src': EXAMPLES_SRC,
    },
    // 自动补全文件扩展名，导入时可省略.ts/.js等后缀
    extensions: ['.ts', '.js', '.mjs', '.json'],
  },
  plugins: [react()],
})
