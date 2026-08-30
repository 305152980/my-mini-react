import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierPlugin from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default [
  // 1. 全局忽略。
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.d.ts'],
  },

  // 2. 基础 JS 规则（等效 eslint:recommended）。
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      ...js.configs.recommended.rules,
    },
    languageOptions: {
      ecmaVersion: 'latest', // 支持最新 ECMAScript 语法（自动跟随 Node.js 版本）。
      sourceType: 'module', // 使用 ES 模块（import/export）。
      globals: {
        ...globals.browser, // 浏览器全局变量：window、document、fetch 等。
        ...globals.node, // Node.js 全局变量：process、__dirname、Buffer 等。
      },
    },
  },

  // 3. TypeScript 规则（等效 @typescript-eslint/recommended）。
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
    },
    languageOptions: {
      parser: tseslint.parser, // TypeScript 专用解析器，让 ESLint 能理解 TS 语法。
      parserOptions: {
        projectService: true, // 启用类型感知服务，让规则能读取类型信息。
        tsconfigRootDir: __dirname, // 指定 tsconfig.json 的查找根目录。
      },
    },
  },

  // 当 ESLint 处理不同包的文件时：
  //   文件路径	                        使用的 tsconfig
  //   packages/react/src/index.ts      packages/react/tsconfig.json
  //   packages/react-dom/src/index.ts  packages/react-dom/tsconfig.json
  //   packages/scheduler/src/index.ts  packages/scheduler/tsconfig.json
  // TypeScript 的项目服务会自动找到最近的 tsconfig.json，不需要手动指定每个包的配置。

  // 4. Prettier 作为 ESLint 规则（等效 prettier/prettier: "error"）。
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error', // 格式化问题 → ESLint 错误。
    },
  },

  // 5. 关闭与 Prettier 冲突的规则（必须放最后）。
  {
    ...prettierConfig,
  },
]
