# Vercel 组织项目快速部署指南

针对 `video-zms/sunshare` 项目的快速部署步骤。

## 🚀 快速开始（3 步）

### 步骤 1: 授权 Vercel 访问 GitHub 组织

1. 访问 [vercel.com/account/integrations](https://vercel.com/account/integrations)
2. 找到 GitHub 集成，点击 "Configure"
3. 找到 `video-zms` 组织，点击 "Grant Access" 或 "Request Access"

**⚠️ 重要**：
- 如果你是组织成员但不是管理员，需要**联系组织管理员**批准授权
- 组织管理员需要在 GitHub 中批准：`https://github.com/organizations/video-zms/settings/installations`

### 步骤 2: 导入项目

1. 访问 [vercel.com/new](https://vercel.com/new)
2. 点击右上角的组织切换器，选择 `video-zms`
3. 找到 `sunshare` 仓库，点击 "Import"

### 步骤 3: 配置并部署

1. **框架设置**（通常自动检测）：
   - Framework: Vite
   - Build Command: `pnpm build`
   - Output Directory: `dist`

2. **环境变量**（必需）：
   ```
   VITE_API_KEY=你的API密钥
   ```

3. 点击 "Deploy"

## 🔐 组织管理员操作

如果你是 `video-zms` 组织的管理员：

### 在 GitHub 中授权 Vercel

1. 访问：`https://github.com/organizations/video-zms/settings/installations`
2. 找到 "Vercel" 应用
3. 点击 "Configure"
4. 选择要授权的仓库（或选择 "All repositories"）
5. 点击 "Save"

### 在 Vercel 中批准访问请求

1. 访问 [vercel.com/account/integrations](https://vercel.com/account/integrations)
2. 查看是否有待处理的访问请求
3. 批准对 `video-zms` 组织的访问

## ❓ 常见问题

### Q: 看不到组织项目怎么办？

**A**: 按以下顺序检查：

1. ✅ 确认已登录正确的 GitHub 账号
2. ✅ 确认账号有 `video-zms` 组织的访问权限
3. ✅ 在 Vercel 中授权访问组织（见步骤 1）
4. ✅ 联系组织管理员批准 Vercel 访问

### Q: 提示"需要组织管理员批准"？

**A**: 
- 如果你是组织成员：联系组织管理员
- 如果你是管理员：在 GitHub 组织设置中批准 Vercel 应用

### Q: 部署后如何添加团队成员？

**A**: 
1. 在 Vercel 项目设置中
2. 进入 "Settings" → "Team Members"
3. 添加组织成员并设置权限

## 📚 详细文档

查看 [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) 获取完整的部署文档。

## 🔗 相关链接

- 项目仓库: [github.com/video-zms/sunshare](https://github.com/video-zms/sunshare)
- Vercel Dashboard: [vercel.com/dashboard](https://vercel.com/dashboard)
- Vercel 集成设置: [vercel.com/account/integrations](https://vercel.com/account/integrations)

