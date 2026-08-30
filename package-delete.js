const packageJson = {
  devDependencies: {
    // ESLint:
    // 提供常见的全局变量（如 window, document）的类型定义，配合 ESLint 使用，防止 ESLint 误报全局变量未定义的错误。
    globals: '17.4.0',

    // // ESLint v8- + Prettier:
    // // 这是代码检查的“核心引擎”或“质量总监”。它本身并不直接理解任何特定语言的语法，而是依赖于解析器（Parser）将代码转换为抽象语法树（AST），然后再根据配置的规则（Rules）对 AST 进行遍历和校验，最终输出问题报告。
    // eslint: '10.0.3',
    // // 这是 ESLint 的“翻译官”。
    // //   作用：ESLint 默认的解析器看不懂 TypeScript 代码。这个解析器负责读取 TypeScript 源码，将其转换为 ESLint 能够理解的 AST 格式。
    // //   为什么需要它：如果没有它，ESLint 遇到 interface、type 等 TS 专属语法时，就会直接报语法错误（Parsing error），导致检查中断。
    // '@typescript-eslint/parser': '8.57.0',
    // // 这是 ESLint 的“TS 专属规则库”。
    // //   作用：虽然解析器让 ESLint 看懂了 TS 语法，但 ESLint 内置的规则（如 no-unused-vars）往往无法处理 TS 特有的类型定义。这个插件提供了一系列专门为 TypeScript 量身定制的规则（例如 @typescript-eslint/no-explicit-any、@typescript-eslint/no-unused-vars 等）。
    // //   为什么需要它：它弥补了 ESLint 原生规则在 TypeScript 项目中的不足，帮助开发者遵循 TS 的最佳实践并发现潜在的类型相关错误。
    // '@typescript-eslint/eslint-plugin': '8.57.0',
    // // 一个“有态度（Opinionated）”的自动代码格式化工具。
    // prettier: '3.8.1',
    // // 作用：把 Prettier 的格式化能力变成了一条 ESLint 规则，让 ESLint 能够直接“管”代码格式。
    // // 原理：它会在后台运行 Prettier，并将 Prettier 格式化后的代码与你的原始代码进行比对。如果发现不一致，它就会在 ESLint 的检查报告中抛出一个错误（如 error: Insert ',' (prettier/prettier)），并允许你通过运行 eslint --fix 来自动修复这些格式问题。
    // 'eslint-plugin-prettier': '5.5.6',
    // // 作用：它本质上是一个配置集合，专门用来关闭所有与 Prettier 冲突的 ESLint 格式化规则。
    // // 原理：ESLint 本身也带有一些格式化规则（如 semi 分号、quotes 引号、indent 缩进等）。这个包会将这些纯样式类的规则全部设置为 off（关闭），从而确保 ESLint 只专注于检查代码质量（如未使用的变量、潜在的 Bug），而把排版工作完全交给 Prettier。
    // 'eslint-config-prettier': '10.1.8',
    // // 主要用于前端工程化开发中的文件监听与自动化构建。
    // onchange: '7.1.0',

    // ESLint v9+ + Prettier:
    // 这是代码检查的“核心引擎”或“质量总监”。它本身并不直接理解任何特定语言的语法，而是依赖于解析器（Parser）将代码转换为抽象语法树（AST），然后再根据配置的规则（Rules）对 AST 进行遍历和校验，最终输出问题报告。
    eslint: '10.0.3',
    // ESLint 官方提供的 JavaScript 核心规则集（如 eslint:recommended）。
    '@eslint/js': '10.0.1',
    // 这是 @typescript-eslint 团队推出的新一代统一包，旨在简化配置，它整合了 parser 和 plugin 的功能。
    'typescript-eslint': '8.57.0',
    // 一个“有态度（Opinionated）”的自动代码格式化工具。
    prettier: '3.8.1',
    // 作用：把 Prettier 的格式化能力变成了一条 ESLint 规则，让 ESLint 能够直接“管”代码格式。
    // 原理：它会在后台运行 Prettier，并将 Prettier 格式化后的代码与你的原始代码进行比对。如果发现不一致，它就会在 ESLint 的检查报告中抛出一个错误（如 error: Insert ',' (prettier/prettier)），并允许你通过运行 eslint --fix 来自动修复这些格式问题。
    'eslint-plugin-prettier': '5.5.6',
    // 作用：它本质上是一个配置集合，专门用来关闭所有与 Prettier 冲突的 ESLint 格式化规则。
    // 原理：ESLint 本身也带有一些格式化规则（如 semi 分号、quotes 引号、indent 缩进等）。这个包会将这些纯样式类的规则全部设置为 off（关闭），从而确保 ESLint 只专注于检查代码质量（如未使用的变量、潜在的 Bug），而把排版工作完全交给 Prettier。
    'eslint-config-prettier': '10.1.8',
    // 主要用于前端工程化开发中的文件监听与自动化构建。
    onchange: '7.1.0',

    // TypeScript：
    typescript: '^5.9.3', // TypeScript 编译器核心，负责将 TS 代码编译为 JS 并进行静态类型检查。
    '@types/node': '26.2.0', // 提供 Node.js 内置模块（path、fs、http 等）和全局变量（__dirname、process 等）的 TypeScript 类型声明，让 TypeScript 能识别和检查 Node.js API。

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
    'rollup-plugin-dts': '6.5.1', // 用于将项目中分散的 .d.ts TypeScript 类型定义文件打包合并成一个单独的类型声明文件。
  },
}

export { packageJson }

// rollup-plugin-esbuild：默认不读取任何 tsconfig，用 esbuild 自己的默认配置转译 TypeScript（不做类型检查）。
// rollup-plugin-dts：默认从当前工作目录向上查找最近的 tsconfig.json，也就是会用到根目录的 tsconfig.json。
