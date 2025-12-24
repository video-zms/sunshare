# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SunStudio 是一个基于 Vue 3 的多媒体创作工作室应用，提供节点式画布界面，支持 AI 驱动的图像生成、视频生成、音频生成、故事创作和分镜管理功能。

## Development Commands

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 类型检查并构建
pnpm build

# 预览构建结果
pnpm preview
```

## Architecture

### Tech Stack
- **Framework**: Vue 3 (Composition API with `<script setup>`)
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS (inline classes)
- **Icons**: lucide-vue-next
- **AI Services**: Google Gemini API (@google/genai), LangChain

### Core Structure

```
src/
├── App.vue              # 主应用组件，包含画布、节点系统、所有面板
├── main.ts              # 应用入口
├── types/index.ts       # 所有 TypeScript 类型定义
├── composables/         # Vue 组合式函数
│   ├── useCanvas.ts     # 画布状态管理（节点、连接、分组、历史记录）
│   ├── useChat.ts       # 聊天功能
│   ├── useSettings.ts   # 设置管理
│   ├── useKeyboard.ts   # 键盘快捷键
│   └── useSmartSequence.ts
├── services/
│   ├── geminiService.ts # AI 服务封装（图像/视频/音频生成、故事创作）
│   ├── llmService.ts    # 多模型 LLM 服务（支持 Gemini/OpenAI/Anthropic/DeepSeek）
│   ├── storage.ts       # IndexedDB 持久化存储
│   └── videoStrategies.ts
└── components/
    ├── Node.vue         # 节点组件
    ├── StoryboardPanel.vue  # 分镜面板
    ├── SidebarDock.vue  # 侧边栏
    └── storyboard/      # 分镜相关子组件
```

### Key Concepts

**节点系统 (Node System)**
- 节点类型定义在 `NodeType` 枚举中：`PROMPT_INPUT`, `IMAGE_GENERATOR`, `VIDEO_GENERATOR`, `AUDIO_GENERATOR`, `VIDEO_ANALYZER`, `IMAGE_EDITOR`, `STORY_GENERATOR`
- 节点状态：`IDLE`, `WORKING`, `SUCCESS`, `ERROR`
- 节点通过 `inputs` 数组和 `connections` 建立连接关系

**状态管理**
- 使用 `useCanvas` composable 管理画布状态
- 数据通过 IndexedDB 持久化（`storage.ts`）
- 支持撤销/重做历史记录

**AI 服务**
- `geminiService.ts` 封装所有 AI 生成功能
- 支持独立配置图像生成、视频生成、Sora 视频生成的 API Key
- 环境变量 `VITE_API_KEY` 用于默认 API Key

## Environment Variables

在项目根目录创建 `.env.dev` 文件：

```
VITE_API_KEY=your_gemini_api_key
VITE_API_BASE_URL=optional_custom_base_url
```

## Code Conventions

- 组件使用 `<script setup lang="ts">` 语法
- 使用 Composition API 和 `ref`/`computed`/`watch`
- 路径别名：`@/` 映射到 `src/`
- 中文 UI 文本，代码注释可中英混合
- 使用 Tailwind CSS 内联样式
