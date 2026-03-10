// eslint.config.js
// 🌟 现代化 ESLint 扁平配置（Flat Config）
// ✅ 适用于 Vue 3 + TypeScript + Prettier 项目
// ✅ 兼容 ESLint v9+ 与 typescript-eslint v8+
// ✅ 无废弃警告，符合官方最佳实践

import js from '@eslint/js' // ESLint 官方 JavaScript 推荐规则
import vue from 'eslint-plugin-vue' // Vue 3 官方 ESLint 插件（支持 <script setup> 和 TS）
import tseslint from 'typescript-eslint' // TypeScript 官方 ESLint 工具包（含 parser + plugin）
import prettierConfig from 'eslint-config-prettier' // 关闭与 Prettier 冲突的格式规则（⚠️ 注意拼写：prettier）
import globals from 'globals' // 提供标准全局变量定义（如 browser、node）

// 🔧 获取当前配置文件所在目录（兼容 ESM 环境）
//    用于定位 tsconfig.json，确保类型检查路径正确
const __filename = import.meta.url
const __dirname = new URL('.', __filename).pathname

// 🚀 导出扁平配置数组（ESLint v9+ 标准方式）
//    配置顺序很重要：越靠前的规则优先级越高，Prettier 必须放在最后
export default [
  // ───────────────────────────────────────────────────────
  // 🚫 全局忽略模式（等效于 .eslintignore，但更集成）
  //    这些路径下的文件将完全跳过 ESLint 检查，提升性能
  {
    ignores: [
      'dist/**', // 构建产物目录
      'node_modules/**', // 第三方依赖（无需 lint）
      'public/**', // 静态资源（通常不含可 lint 的 JS/TS）
      'coverage/**', // 测试覆盖率报告
      '*.config.*', // 构建/工具配置文件（如 vite.config.ts），可选是否忽略
      '**/*.d.ts', // TypeScript 声明文件（由编译器生成，无需人工 lint）
    ],
  },

  // ───────────────────────────────────────────────────────
  // 📜 基础 JavaScript 规则
  //    适用于纯 JS 文件（如 eslint.config.js、vite.config.js）
  {
    files: ['**/*.js'],
    ...js.configs.recommended, // 启用 ESLint 官方推荐规则（如 no-unused-vars）
    languageOptions: {
      ecmaVersion: 'latest', // 支持最新 ECMAScript 语法（自动跟随 Node.js 版本）
      sourceType: 'module', // 使用 ES 模块（import/export）
    },
  },

  // ───────────────────────────────────────────────────────
  // 🖼️ Vue 3 组件规则
  //    使用官方提供的 'flat/essential' 规则集：
  //    - 包含模板语法检查（如 v-for key）
  //    - 支持 <script setup lang="ts">
  //    - 自动处理 .vue 文件结构
  ...vue.configs['flat/essential'],

  // ───────────────────────────────────────────────────────
  // 🔧 TypeScript 专用规则（带类型感知）
  //    仅应用于 .ts / .tsx 文件，启用高级类型检查规则
  //    ⚠️ 要求项目根目录存在 tsconfig.json
  {
    files: ['**/*.{ts,tsx}'],
    ...tseslint.configs.recommended, // 启用 @typescript-eslint/recommended
    languageOptions: {
      parser: tseslint.parser, // 使用 TypeScript 专用解析器
      parserOptions: {
        project: true, // 启用类型信息（用于 no-unsafe-assignment 等规则）
        tsconfigRootDir: __dirname, // 基于当前配置文件定位 tsconfig.json
      },
    },
  },

  // ───────────────────────────────────────────────────────
  // 🌐 全局环境变量定义
  //    为所有前端相关文件注入浏览器和 Node.js 全局变量
  //    避免 window、process、console 等被误报为 'no-undef'
  {
    files: ['**/*.{js,ts,tsx,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser, // 浏览器环境：window, document, fetch, localStorage...
        ...globals.node, // Node.js 环境：process, __dirname, require, Buffer...
      },
    },
  },

  // ───────────────────────────────────────────────────────
  // 🛑 Prettier 兼容层（必须放在最后！）
  //    此配置会禁用所有与 Prettier 格式化冲突的 ESLint 规则
  //    例如：缩进、引号、分号、行宽等 → 交由 Prettier 统一处理
  //    ✅ 实现 "ESLint 管质量，Prettier 管风格" 的职责分离
  prettierConfig,
]
