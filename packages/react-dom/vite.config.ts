import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

// 路径常量 - 语义化命名，统一管理monorepo各目录绝对路径
const PROJECT_ROOT = resolve(__dirname, '../../') // 项目根目录
const REACT_DOM_ROOT = __dirname // react-dom包根目录
const REACT_DOM_SRC = resolve(REACT_DOM_ROOT, 'src') // react-dom源码目录

// Vite多环境配置 - 自动识别mode：开发(development)/生产(production)
export default defineConfig(({ mode }) => ({
  // 模块解析配置
  resolve: {
    // 路径别名
    alias: {},
    // 自动补全文件扩展名，导入时可省略.ts/.js等后缀
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },

  // 构建核心配置 - 库模式打包
  build: {
    // 产物输出目录 - react-dom打包后所有文件输出到包根目录的dist下
    outDir: resolve(REACT_DOM_ROOT, 'dist'),
    // 源码映射 - 开发环境保留（方便调试），生产环境关闭（减小包体积、保护源码）
    sourcemap: mode === 'development',
    // 打包前清空输出目录 - 避免旧产物残留，保证构建产物纯净
    emptyOutDir: true,
    // 代码压缩 - 生产环境开启esbuild压缩，开发环境关闭（方便调试源码）
    minify: mode === 'production',
    // 库模式配置 - 打包为可复用的ES/CJS格式库，而非前端应用
    lib: {
      entry: resolve(REACT_DOM_ROOT, 'index.ts'), // 库入口文件
      name: 'MyMiniReactReactDOM', // 全局变量名（预留UMD/IIFE格式使用）
      fileName: format => `react-dom.${format}.js`, // 产物命名：按模块格式区分
      formats: ['es', 'cjs'], // 输出模块格式：ESModule + CommonJS，适配多环境
    },
    // Rollup底层配置 - 定制库模式打包规则
    rollupOptions: {
      external: [], // 空数组表示无外部依赖，强制将shared+scheduler+react-reconciler源码合并打入react-dom产物
      output: { globals: {} }, // 无全局依赖，留空即可
    },
  },

  // 插件配置
  plugins: [
    // 配置 vite-plugin-dts 插件，以便在打包构建时，自动为你的 React 库生成 TypeScript 类型声明文件（.d.ts），并且能够正确处理跨包（如 shared 包）的类型引用。
    dts({
      outDir: resolve(REACT_DOM_ROOT, 'dist'), // 类型文件输出目录，与JS产物同目录
      entryRoot: REACT_DOM_ROOT, // 类型声明的根目录
      include: [REACT_DOM_ROOT], // 包含react-dom包的所有文件，确保类型检查覆盖整个包
      tsconfigPath: resolve(REACT_DOM_ROOT, 'tsconfig.json'), // 指定当前包的TS配置文件
      cleanVueFileName: false, // 非Vue项目，关闭Vue文件名清理逻辑
      copyDtsFiles: true, // 复制依赖的类型文件到输出目录，避免类型引用缺失
    }),
  ],
}))
