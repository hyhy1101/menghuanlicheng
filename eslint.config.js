import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import prettier from 'eslint-config-prettier'

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/drizzle/migrations/**', 'prototype/**', 'vben-admin/**', '.cache/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Node 侧：Electron 主进程 / preload / updater、打包与发版脚本、以及本配置文件自身。
  //
  // 这些 globals 在这里统一直明一次。早先的做法是在每个文件顶上写一行 global 注释
  // 逐个人工声明，漏一个就是一片 no-undef（check-update-feed.mjs 就漏了，一次报 19 条）。
  // 而且那行注释和这里的声明会撞车 —— 同一个名字既在注释里声明又在 globals 里存在，
  // no-redeclare 会直接报"已定义为内置全局变量"。
  {
    files: ['**/*.cjs', '**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },

  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: { vue },
    rules: {
      ...vue.configs['flat/recommended'].rules,
      'vue/multi-word-component-names': 'off'
    }
  },

  // TS 与 Vue：关掉 no-undef。
  //
  // typescript-eslint 官方建议不要在 TS 项目里启用这条规则 —— no-undef 不做类型分析，
  // 认不出类型位上的标识符，会对 `function f(e: Event)` 这种纯类型写法误报。
  // 之前是靠一份手工维护的 DOM 白名单压着（HTMLInputElement、KeyboardEvent 都是这么
  // 一条条喂进去的），Event / HTMLImageElement 一漏就报错。
  //
  // "标识符未定义"这件事本来就由 tsc / vue-tsc 负责，见 pnpm typecheck。
  // 普通 .js（如 assets/echarts-theme.js）不受这里影响，仍保留 no-undef 检查。
  {
    files: ['**/*.ts', '**/*.vue'],
    rules: {
      'no-undef': 'off'
    }
  },

  // 微信小程序：页面与工具都是 CommonJS + 小程序全局对象，
  // 不经打包、不能用 ESM import，因此单独声明运行环境。
  {
    files: ['apps/miniprogram/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        wx: 'readonly',
        App: 'readonly',
        Page: 'readonly',
        Component: 'readonly',
        getApp: 'readonly',
        getCurrentPages: 'readonly',
        console: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        require: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },

  prettier
]
