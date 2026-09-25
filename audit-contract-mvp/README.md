# 合同辅助审查（Coze 国内版工作流桌面 Web 壳）

本仓库是给 Lee CCC 用的第一期切片：浏览器上传一份 PDF / DOCX，填写公司名并选择审查模式（严格审查 / 快速审查） → 服务端传到 Coze 文件 API → 用开始节点必填入参 `hetong`（`{"file_id":"..."}`）、`gongsiming`、`shenchamoshi` 跑已有工作流 → 页面展示风险 / 条款要点 / 建议。

**辅助审查，不构成法律意见。**

当前云端仓库用于开发预览。Windows 本机 Worker 不可用时，把本仓库拷到交付目录即可。

## 本机运行

需要 Node.js 20+。

```bash
npm install
cp .env.example .env.local
npm run dev
```

浏览器打开 [http://127.0.0.1:43177](http://127.0.0.1:43177)。服务绑定 `0.0.0.0:43177`。

未填写 `COZE_API_TOKEN`，或 `USE_MOCK_COZE=1` 时，走本地示例结果，页顶会显示「当前为本地示例结果」。没有 PAT 也能把空状态、上传、加载、成功、错误、不支持类型全部点一遍。

## 拷到 Windows 交付目录

仓库根目录拷到：

`D:\Cursor coding data\Audit contract`

路径含空格，PowerShell 里请给路径加引号，例如：

```powershell
cd "D:\Cursor coding data\Audit contract"
npm install
copy .env.example .env.local
npm run dev
```

不要把 `.env.local` 提交进 git。

## 接真实 Coze（国内版）

1. 只在 **https://www.coze.cn 开放平台** 领取 PAT，不要用 coze.com 的 token。
2. 打开本机 `.env.local`（不要发到聊天、不要写进 README）：

```
COZE_API_BASE=https://api.coze.cn
COZE_API_TOKEN=这里只写在本机文件里
COZE_WORKFLOW_ID=7667956412068855851
COZE_SPACE_ID=7570680287668158515
USE_MOCK_COZE=0
```

3. 保存后**重启** `npm run dev`。
4. 工作流控制台：`https://www.coze.cn/work_flow?workflow_id=7667956412068855851&space_id=7570680287668158515`

MVP **不传** 可选 Excel `other_standard`，也 **省略** 可选字符串 `input`。不会把整份 PDF 当字符串参数。`shenchamoshi` 只发送 `严格审查` 或 `快速审查`（无多余空格、无冒号）。

出参 schema 尚未由平台锁定：适配层按「风险 / 条款 / 建议」尽力映射，并**始终保留原始输出**。未接 PAT 前不要声称「已接上 Coze」。

## 脚本

- `npm run dev` — 开发服务，端口 43177
- `npm run build` / `npm start` — 生产构建与启动
- `npm run lint` — ESLint

## 第一期不做

批量文件、审查历史库、登录、在线改 Word、安装包（.exe）。审查规则继续改 Coze 工作流，不在本仓库重写。
