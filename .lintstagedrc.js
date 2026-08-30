// 导入 ESLint 类，用于检查文件是否被忽略。
import { ESLint } from 'eslint'

/**
 * 过滤掉被 ESLint 忽略的文件，返回未被忽略的文件列表（空格分隔的字符串）。
 *
 * @param {string[]} files - 待检查的文件路径数组
 * @returns {Promise<string>} 未被忽略的文件路径，以空格分隔
 *
 * @example
 * const filesToLint = await removeIgnoredFiles(['src/a.ts', 'dist/b.ts'])
 * 返回: 'src/a.ts'（dist/b.ts 被 .eslintignore 忽略）。
 */
const removeIgnoredFiles = async files => {
  // 创建 ESLint 实例（默认启用忽略规则）。
  const eslint = new ESLint()
  // 检查每个文件是否被 .eslintignore 忽略，返回布尔值数组。
  const isIgnoredFiles = await Promise.all(
    files.map(file => eslint.isPathIgnored(file))
  )
  // 过滤掉被忽略的文件，保留未被忽略的文件。
  const filteredFiles = files.filter((file, i) => !isIgnoredFiles[i])
  // 将文件数组拼接为空格分隔的字符串（供命令行使用）。
  return filteredFiles.join(' ')
}

// lint-staged 配置：对所有暂存文件执行检查。
export default {
  // '*' 匹配所有文件类型。
  '*': async files => {
    // 过滤掉被 .eslintignore 忽略的文件，返回空格分隔的字符串。
    const filesToLint = await removeIgnoredFiles(files)
    // 对未被忽略的文件运行 ESLint 检查。
    return [`eslint ${filesToLint}`]
  },
}

// 执行流程：
//   git add src/a.ts src/b.ts dist/c.ts
//            ↓
//   lint-staged 触发，files = ['src/a.ts', 'src/b.ts', 'dist/c.ts']
//            ↓
//   removeIgnoredFiles() 过滤
//            ↓
//   filesToLint = 'src/a.ts src/b.ts'（dist/c.ts 被忽略）
//            ↓
//   执行命令: eslint src/a.ts src/b.ts

// 完整流程：
//   git commit -m "fix: update"
//            ↓
//   触发 .husky/pre-commit hook
//            ↓
//   执行 pnpm exec lint-staged
//            ↓
//   lint-staged 读取 .lintstagedrc.js 配置
//            ↓
//   对暂存文件运行 eslint
//            ↓
//   通过 → commit 成功
//   失败 → commit 被阻止
