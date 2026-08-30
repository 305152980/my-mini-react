// commitlint 配置：校验 git commit 信息格式。
export default {
  // 继承 conventional commits 规则集（feat:、fix:、docs: 等标准格式）。
  extends: ['@commitlint/config-conventional'],
  // 自定义规则（覆盖默认配置）。
  rules: {
    // type 必须是以下值之一。
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新功能（feature）。
        'fix', // 修复 bug。
        'docs', // 文档变更（documentation）。
        'style', // 代码格式（不影响代码运行，如空格、分号等）。
        'refactor', // 重构（既不是新功能，也不是修复 bug）。
        'test', // 增加测试或修改测试。
        'chore', // 构建过程或辅助工具的变动（如修改配置、依赖等）。
        'revert', // 回退（撤销之前的提交）。
      ],
    ],
    // scope 不能为空：必须有作用域。
    'scope-empty': [2, 'never'],
    // subject 不能为空。
    'subject-empty': [2, 'never'],
  },
}
