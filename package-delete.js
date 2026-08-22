const packageJson = {
  devDependencies: {
    // 用于保证代码风格统一和发现潜在错误：
    eslint: '10.0.3', // 核心的 JavaScript/TypeScript 代码静态检查工具，用于发现代码中的错误、潜在问题和规范违规。
    '@eslint/js': '10.0.1', // ESLint 官方提供的 JavaScript 核心规则集（如 eslint:recommended），在 ESLint v9+ 的扁平化配置中被广泛使用。
    'eslint-config-prettier': '10.1.8', // 用于关闭所有与 Prettier 冲突的 ESLint 规则，让 ESLint 只负责代码质量，Prettier 专心负责代码格式化，避免两者打架。
    prettier: '3.8.1', // 代码格式化工具，自动统一代码的缩进、引号、分号等样式。
    globals: '17.4.0', // 提供常见的全局变量（如 window, document）的类型定义，配合 ESLint 使用，防止 ESLint 误报全局变量未定义的错误。

    // 让 ESLint 能够“看懂” TypeScript 和 React/Vue 代码：
    '@typescript-eslint/eslint-plugin': '8.57.0', // 提供了一系列专门针对 TypeScript 的 ESLint 规则（如禁止隐式 any 等）。
    '@typescript-eslint/parser': '8.57.0', // TypeScript 解析器，将 TS 代码转换为 ESLint 能理解的抽象语法树 (AST)。
    'typescript-eslint': '8.57.0', // 这是 @typescript-eslint 团队推出的新一代统一包，旨在简化配置（特别是在 ESLint v9 的扁平化配置中），它整合了 parser 和 plugin 的功能。
    'eslint-plugin-react': '7.37.5', // 提供 React 专属的 lint 规则，检查 JSX 语法和 React 最佳实践。
    'eslint-plugin-react-hooks': '7.0.1', // 专门检查 React Hooks 的使用规范（例如确保依赖项数组正确）。
    'eslint-plugin-react-refresh': '0.5.2', // 确保组件符合 Vite/React Fast Refresh 的要求，保证热更新（HMR）能正常工作。
    'eslint-plugin-vue': '10.8.0', // 提供 Vue.js 专属的 lint 规则，检查 Vue 模板和脚本的规范。

    // TypeScript：
    typescript: '^5.9.3', // TypeScript 编译器核心，负责将 TS 代码编译为 JS 并进行静态类型检查。

    // 测试：
    vitest: '4.1.5',

    // rollup 打包相关：
    rollup: '4.62.4', // 打包工具，将多个模块合并打包为 bundle。
    rimraf: '6.1.3', // // 跨平台的 "rm -rf"，构建前清理 dist 目录。
    'rollup-plugin-generate-package-json': '3.2.0', // 构建时自动生成 package.json 到输出目录。
    '@rollup/plugin-alias': '6.0.0', // 模块路径别名替换（如 ReactFiberHostConfig → 具体实现文件）。
    '@rollup/plugin-replace': '6.0.3', // 构建时字符串替换。
    '@rollup/plugin-commonjs': '29.0.3', // 将 node_modules 中的 CommonJS 模块转换为 ESM 模块。
    '@rollup/plugin-node-resolve': '16.0.3', // 让 Rollup 能解析 node_modules 中的模块。没有它，Rollup 只能解析相对路径（./foo）和绝对路径，不能解析裸模块名。
    'rollup-plugin-esbuild': '6.2.1', // 用 esbuild 将 TypeScript 转换为 JavaScript（剥离类型，不做类型检查）。
  },
}

export { packageJson }
