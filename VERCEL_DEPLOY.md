# Vercel 部署指南

本文档说明如何将 SunShareVideoStudio 项目部署到 Vercel。

## 前置要求

1. 一个 Vercel 账号（如果没有，请访问 [vercel.com](https://vercel.com) 注册）
2. 项目已推送到 Git 仓库（GitHub、GitLab 或 Bitbucket）
3. **对于 GitHub 组织项目**：确保你有组织的访问权限

## GitHub 组织项目部署说明

如果你的项目在 GitHub 组织内（例如：`video-zms/sunshare`），需要特别注意以下事项：

### 首次部署组织项目

1. **授权 Vercel 访问 GitHub 组织**
   - 登录 Vercel 后，访问 [vercel.com/account/integrations](https://vercel.com/account/integrations)
   - 找到 GitHub 集成，点击 "Configure"
   - 在组织列表中，找到你的组织（如 `video-zms`）
   - 点击 "Grant Access" 或 "Request Access"
   - **注意**：如果组织启用了第三方应用限制，可能需要组织管理员批准

2. **组织权限设置**
   - 如果无法看到组织项目，请联系组织管理员
   - 组织管理员需要在 GitHub 设置中授权 Vercel 访问
   - 路径：GitHub 组织设置 → Third-party access → Vercel

### 组织管理员操作步骤

如果你是组织管理员，需要授权 Vercel 访问：

1. **在 GitHub 中授权**
   - 访问组织设置：`https://github.com/organizations/video-zms/settings/installations`
   - 找到 Vercel 应用
   - 点击 "Configure" 或 "Grant Access"
   - 选择要授权的仓库或全部仓库

2. **在 Vercel 中配置**
   - 访问 [vercel.com/account/integrations](https://vercel.com/account/integrations)
   - 确保组织已授权
   - 如果未授权，点击 "Request Access"

## 部署步骤

### 方法一：通过 Vercel Dashboard 部署（推荐）

1. **登录 Vercel**
   - 访问 [vercel.com](https://vercel.com)
   - 使用 GitHub 账号登录（确保该账号有组织访问权限）

2. **导入项目**
   - 点击 "Add New..." → "Project"
   - 如果看不到组织项目，点击右上角的组织切换器，选择你的组织（如 `video-zms`）
   - 在仓库列表中找到 `sunshare` 项目
   - 点击 "Import"
   
   > **提示**：如果看不到组织项目，请参考上面的"GitHub 组织项目部署说明"

3. **配置项目**
   - **Framework Preset**: Vite（会自动检测）
   - **Root Directory**: `./`（默认）
   - **Build Command**: `pnpm build`（已自动配置）
   - **Output Directory**: `dist`（已自动配置）
   - **Install Command**: `pnpm install`（已自动配置）

4. **配置环境变量**
   在 "Environment Variables" 部分添加以下变量：
   
   ```
   VITE_API_KEY=你的API密钥
   VITE_API_BASE_URL=你的API基础URL（可选）
   ```
   
   > **注意**: 
   - `VITE_API_KEY` 是必需的
   - `VITE_API_BASE_URL` 是可选的，如果不需要可以留空
   - 环境变量会在构建时注入到应用中

5. **部署**
   - 点击 "Deploy" 按钮
   - 等待构建完成（通常需要 1-3 分钟）

6. **访问应用**
   - 部署完成后，Vercel 会提供一个 URL（例如：`https://your-project.vercel.app`）
   - 点击 URL 即可访问你的应用

### 方法二：通过 Vercel CLI 部署

1. **安装 Vercel CLI**
   ```bash
   npm i -g vercel
   # 或
   pnpm add -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **在项目目录中部署**
   ```bash
   cd /path/to/SunShareVideoStudio
   vercel
   ```

4. **配置环境变量**
   ```bash
   vercel env add VITE_API_KEY
   vercel env add VITE_API_BASE_URL  # 可选
   ```

5. **生产环境部署**
   ```bash
   vercel --prod
   ```

## 环境变量说明

### 必需的环境变量

- **VITE_API_KEY**: 用于 Gemini API 或其他 AI 服务的 API 密钥

### 可选的环境变量

- **VITE_API_BASE_URL**: API 服务的基础 URL（如果需要自定义 API 端点）

## 自动部署

配置完成后，每次推送到主分支（通常是 `main` 或 `master`）时，Vercel 会自动触发新的部署。

### 分支部署

- **Production**: 主分支的部署（通常是 `main` 或 `master`）
- **Preview**: 其他分支的部署（用于测试）

## 自定义域名

1. 在 Vercel Dashboard 中进入项目设置
2. 点击 "Domains"
3. 添加你的自定义域名
4. 按照提示配置 DNS 记录

## 常见问题

### 0. 无法看到组织项目

**问题**: 在 Vercel 中看不到 GitHub 组织的项目

**解决方案**:
- 确保已授权 Vercel 访问 GitHub 组织
- 检查你的 GitHub 账号是否有该组织的访问权限
- 联系组织管理员，请求授权 Vercel 访问
- 访问 [vercel.com/account/integrations](https://vercel.com/account/integrations) 检查集成状态
- 如果组织启用了第三方应用限制，需要管理员在 GitHub 中批准

**GitHub 组织设置路径**:
- 组织设置 → Third-party access → Vercel → Configure

### 1. 构建失败

**问题**: 构建过程中出现错误

**解决方案**:
- 检查 `package.json` 中的依赖是否正确
- 确保 Node.js 版本兼容（Vercel 默认使用 Node.js 18.x）
- 查看构建日志中的具体错误信息

### 2. 环境变量未生效

**问题**: 部署后环境变量没有正确加载

**解决方案**:
- 确保环境变量名称以 `VITE_` 开头（Vite 的要求）
- 重新部署项目（环境变量更改后需要重新构建）
- 检查环境变量是否已添加到正确的环境（Production/Preview/Development）

### 3. 路由问题（404 错误）

**问题**: 刷新页面或直接访问路由时出现 404

**解决方案**:
- 已配置 `vercel.json` 中的 `rewrites` 规则，所有路由都会重定向到 `index.html`
- 如果仍有问题，检查 `vercel.json` 配置是否正确

### 4. 静态资源加载失败

**问题**: 图片、CSS 等静态资源无法加载

**解决方案**:
- 检查 `vite.config.ts` 中的 `base` 配置
- 确保资源路径使用相对路径或正确的绝对路径
- 检查 Vercel 的构建输出目录是否为 `dist`

## 性能优化建议

1. **启用缓存**
   - 静态资源已配置缓存头（见 `vercel.json`）
   - 确保图片和字体文件使用 CDN

2. **代码分割**
   - Vite 会自动进行代码分割
   - 考虑使用动态导入 (`import()`) 进一步优化

3. **图片优化**
   - 使用 WebP 格式
   - 考虑使用 Vercel 的图片优化服务

## 监控和分析

Vercel 提供了内置的分析和监控功能：

- **Analytics**: 访问量统计
- **Speed Insights**: 性能监控
- **Logs**: 实时日志查看

可以在 Vercel Dashboard 中启用这些功能。

## 回滚部署

如果需要回滚到之前的版本：

1. 在 Vercel Dashboard 中进入 "Deployments"
2. 找到要回滚的部署
3. 点击 "..." → "Promote to Production"

## 组织项目特殊配置

### 团队协作

如果项目在组织内，可以：

1. **添加团队成员**
   - 在 Vercel Dashboard 中进入项目设置
   - 点击 "Settings" → "Team Members"
   - 添加组织成员，设置权限（Viewer/Developer/Owner）

2. **共享环境变量**
   - 环境变量可以在团队内共享
   - 在项目设置中配置环境变量，团队成员都可以使用

3. **部署权限控制**
   - Owner：可以修改所有设置和部署
   - Developer：可以部署和查看日志
   - Viewer：只能查看项目

### 组织级别的配置

组织管理员可以：

1. **统一管理项目**
   - 在 Vercel Dashboard 中切换到组织视图
   - 查看所有组织项目的部署状态
   - 统一管理域名和 SSL 证书

2. **设置组织级别的环境变量**
   - 在组织设置中配置共享环境变量
   - 所有项目都可以使用这些变量

## 更多资源

- [Vercel 文档](https://vercel.com/docs)
- [Vercel GitHub 集成文档](https://vercel.com/docs/concepts/git/vercel-for-github)
- [Vercel 组织管理](https://vercel.com/docs/concepts/organizations)
- [Vite 部署指南](https://vitejs.dev/guide/static-deploy.html#vercel)
- [Vercel CLI 文档](https://vercel.com/docs/cli)

