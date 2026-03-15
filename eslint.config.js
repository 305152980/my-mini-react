// eslint.config.js
// 🌟 现代化 ESLint 扁平配置（Flat Config）
// ✅ 适用于 Vue 3 + React 18+ + TypeScript + Prettier 项目
// ✅ 兼容 ESLint v9+ 与 typescript-eslint v8+
// ✅ 无废弃警告，符合官方最佳实践

import js from '@eslint/js' // ESLint 官方 JavaScript 推荐规则
import vue from 'eslint-plugin-vue' // Vue 3 官方 ESLint 插件（支持 <script setup> 和 TS）
import tseslint from 'typescript-eslint' // TypeScript 官方 ESLint 工具包（含 parser + plugin）
import prettierConfig from 'eslint-config-prettier' // 关闭与 Prettier 冲突的格式规则（⚠️ 注意拼写：prettier）
import globals from 'globals' // 提供标准全局变量定义（如 browser、node）

import react from 'eslint-plugin-react' // React 官方 ESLint 插件（支持 JSX 和 React 18+ 特性）
import reactHooks from 'eslint-plugin-react-hooks' // React Hooks 规则插件（强制遵守 Hooks 规则）
import reactRefresh from 'eslint-plugin-react-refresh' // Vite React 刷新检查插件（仅在 Vite 项目中使用）

// 获取当前配置文件所在目录（兼容 ESM 环境）
// 用于定位 tsconfig.json，确保类型检查路径正确
const __filename = import.meta.url
const __dirname = new URL('.', __filename).pathname

// 导出扁平配置数组（ESLint v9+ 标准方式）
// 配置顺序很重要：越靠前的规则优先级越高，Prettier 必须放在最后
export default [
  // ───────────────────────────────────────────────────────
  // 全局忽略模式（等效于 .eslintignore，但更集成）
  // 这些路径下的文件将完全跳过 ESLint 检查，提升性能
  {
    ignores: [
      'dist/**', // 构建产物目录
      'node_modules/**', // 第三方依赖（无需 lint）
      'public/**', // 静态资源（通常不含可 lint 的 JS/TS）
      'coverage/**', // 测试覆盖率报告
      // '*.config.*', // 构建/工具配置文件（如 vite.config.ts），可选是否忽略
      '**/*.d.ts', // TypeScript 声明文件（由编译器生成，无需人工 lint）
    ],
  },

  // ───────────────────────────────────────────────────────
  // 基础 JavaScript 规则
  // 适用于所有 JS/TS/Vue/React 文件
  {
    files: ['**/*.{js,jsx,ts,tsx,vue}'],
    ...js.configs.recommended, // 启用 ESLint 官方推荐规则（如 no-unused-vars）
    languageOptions: {
      ecmaVersion: 'latest', // 支持最新 ECMAScript 语法（自动跟随 Node.js 版本）
      sourceType: 'module', // 使用 ES 模块（import/export）
      // 全局环境变量定义。为所有前端相关文件注入浏览器和 Node.js 全局变量。避免 window、process、console 等被误报为 'no-undef'。
      globals: {
        ...globals.browser, // 浏览器环境：window, document, fetch, localStorage...
        ...globals.node, // Node.js 环境：process, __dirname, require, Buffer...
      },
    },
  },

  // ───────────────────────────────────────────────────────
  // TypeScript 专用规则（带类型感知）
  // 仅应用于 .ts / .tsx 文件（Vue 的 <script lang="ts"> 也包含在内），启用高级类型检查规则
  // 要求项目根目录存在 tsconfig.json
  {
    files: ['**/*.{ts,tsx,vue}'],
    ...tseslint.configs.recommended, // 启用 @typescript-eslint/recommended
    languageOptions: {
      parser: tseslint.parser, // 使用 TypeScript 专用解析器
      parserOptions: {
        projectService: true, // 启用项目服务，提供完整类型信息（需要 tsconfig.json）
        tsconfigRootDir: __dirname, // 基于当前配置文件定位 tsconfig.json
      },
    },
  },

  // ───────────────────────────────────────────────────────
  // Vue 3 组件规则
  // 使用官方提供的 'flat/essential' 规则集：
  // - 包含模板语法检查（如 v-for key）
  // - 支持 <script setup lang="ts">
  // - 自动处理 .vue 文件结构
  {
    files: ['**/*.vue'],
    ...vue.configs['flat/essential'], // 或 'flat/recommended'
    languageOptions: {
      parser: vue.parser, // Vue 需要自己的解析器
      parserOptions: {
        parser: tseslint.parser, // 嵌套使用 TS 解析器处理 <script lang="ts">
      },
    },
    rules: {
      // 在这里自定义 Vue 规则
      // 例如: 'vue/multi-word-component-names': 'off'
    },
  },

  // ───────────────────────────────────────────────────────
  // ⚛️ React 18+ 专用规则 (仅针对 .jsx / .tsx 文件)
  {
    files: ['**/*.{jsx,tsx}'],
    ...react.configs.recommended,
    ...react.configs['jsx-runtime'], // 自动处理 React 17+ JSX 转换 (无需 import React)
    // 注册插件
    plugins: {
      'react-hooks': reactHooks,
      // 💡 优化：条件注册 react-refresh 插件
      // 只有当插件被成功导入时才注册，避免在非 Vite 项目或未安装插件时报错
      ...(typeof reactRefresh !== 'undefined'
        ? { 'react-refresh': reactRefresh }
        : {}),
    },
    rules: {
      // 启用 React Hooks 推荐规则
      ...reactHooks.configs.recommended.rules,
      // ✅ 优化：显式关闭过时规则
      // 即使 jsx-runtime 已启用，显式关闭也能防止某些旧版配置残留导致的报错
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off', // 💡 额外建议：如果你使用 TypeScript，通常不需要 PropTypes 检查
      // 💡 优化：条件启用 react-refresh 规则
      // 仅在使用了 Vite (即 reactRefresh 存在) 时启用此规则
      ...(typeof reactRefresh !== 'undefined'
        ? {
            'react-refresh/only-export-components': [
              'warn',
              { allowConstantExport: true },
            ],
          }
        : {}),
      // 可选：自定义 React 规则
      // 'react/react-in-jsx-scope': 'off', // jsx-runtime 已自动处理
    },
    settings: {
      react: {
        version: 'detect', // 自动检测项目中安装的 React 版本
      },
    },
  },

  // ───────────────────────────────────────────────────────
  // Prettier 兼容层（必须放在最后！）
  // 此配置会禁用所有与 Prettier 格式化冲突的 ESLint 规则
  // 例如：缩进、引号、分号、行宽等 → 交由 Prettier 统一处理
  // ✅ 实现 "ESLint 管质量，Prettier 管风格" 的职责分离
  {
    ...prettierConfig,
    name: 'prettier-compatibility', // 命名配置块
    rules: {
      ...prettierConfig.rules,
      // 补充关闭 Prettier 覆盖不到的格式规则
      'vue/html-indent': 'off',
      'react/jsx-indent': 'off',
      '@typescript-eslint/indent': 'off',
    },
  },
]
