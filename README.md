# IELTS Listening Mock — 雅思听力在线模考

上传 Word 文档，自动识别题目，雅思 9 分制在线批改。

## 技术栈

| 技术 | 用途 |
|------|------|
| Next.js 15 (App Router) | 前端框架 |
| TypeScript | 类型安全 |
| Tailwind CSS v4 | 样式 |
| Supabase | 数据库 + 存储 |
| JSZip | Word 文档解析 |

## 开发

```bash
npm install
npm run dev
```

## 部署到 Vercel

### 1. 连接 GitHub
在 Vercel Dashboard → Add New → Project → 导入 `Keming-Peng` 仓库

### 2. 设置环境变量
在 Vercel 项目 Settings → Environment Variables 中添加：

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | 你的 Supabase Project URL（见 Supabase Dashboard → Settings → API） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 你的 Supabase anon public key（同上页面） |

### 3. 初始化数据库
在 Supabase Dashboard → SQL Editor 中执行：
```
supabase/migrations/001_init.sql
```

### 4. 创建 Storage Bucket
Supabase Dashboard → Storage → Create new bucket：
- Name: `exam-materials`
- Public: ✅ 勾选

## Word 文档格式

### 填空题格式（推荐）
在 Word 正文中插入填空：
```
Located conveniently at the 11__________ of Marion Street.

答案：
corner
6/six
2/two
...
```

格式要点：
- 填空：`11__________`（数字 + 5个以上下划线）
- 答案：文档末尾写 `答案：` 然后每行一个答案，按题目编号顺序

## 页面说明

- `/` — 试卷列表首页
- `/exam/[id]` — 作答页面
- `/admin` — 管理员上传试卷
