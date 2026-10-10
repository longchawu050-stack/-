# 鸟撞玻璃点位记录

按《校园建筑鸟撞 5 分钟快速筛查量表（试行版 v1.0）》做的现场记录网站，手机打开就能用：

1. 到达点位，填写建筑、点位编号、立面、朝向、天气/光照；
2. 拍照上传：正面全景、斜角反射/通视、周边环境、防护近照；
3. 依次点选 A 玻璃量、B 错觉、C 几何/曲面、D 鸟类暴露、完整有效防护、夜间灯光 N、碰撞证据、飞穿红旗；
4. 自动算出快速筛查指数 R = 2A + 3B + 2C + 2D（0–27）、风险等级和建议，保存为一条记录；
5. 首页按风险等级统计，并给出建筑级风险（取最高单元等级）；一键导出 CSV。

数据存在 [Supabase](https://supabase.com)（免费的云数据库 + 照片存储），全组共用一个网址，各自用手机录入，记录实时同步。
没有配置 Supabase 时，网站以“本机模式”运行，记录只保存在当前浏览器里，适合先试用。

---

## 一、在 StackBlitz 上打开

代码上传到 GitHub 后，把下面网址里的用户名换成你的，浏览器打开即可在线运行和编辑：

```
https://stackblitz.com/github/<你的GitHub用户名>/birdglass-survey
```

StackBlitz 会自动安装依赖并运行 `npm run dev`，右侧就是网站预览。

## 二、配置 Supabase（多人共享数据和照片）

1. 在 <https://supabase.com> 注册并新建一个 Project（Region 选离你近的，如 Singapore / Tokyo）。
2. 左侧 **SQL Editor** → New query，把 `schema.sql` 的全部内容粘贴进去，点 **Run**。
   它会创建 `records` 表、照片存储桶 `glass-photos`、访问权限和实时同步。
3. 左侧 **Project Settings → API**，复制两项：
   - Project URL（形如 `https://xxxx.supabase.co`）
   - Project API keys 里的 **anon public** key
4. 填到项目里，二选一：
   - **简单做法**：打开 `config.js`，把两项分别填进 `|| ''` 的引号里，例如
     `export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xxxx.supabase.co';`
   - **环境变量**：本地开发时复制 `.env.example` 为 `.env` 后填写；GitHub Pages 部署时填到仓库 Secrets（见第四步）。

> anon key 是给网页前端公开用的，可以放进 GitHub。**不要**把 `service_role` key 放进项目。

## 三、上传到 GitHub

所有文件都在同一层，不用拖文件夹：

1. 仓库页点 **Add file → Upload files**（空仓库点 **uploading an existing file**）。
2. 选中文件夹里的全部文件拖进去（Mac 访达里先按 **⌘ + Shift + .** 显示 `.gitignore`、`.stackblitzrc` 等隐藏文件）。
   **不要**上传 `deploy.yml`，它要放到专门的位置（下一步）。点 **Commit changes**。
3. 再点 **Add file → Create new file**，文件名一栏输入 `.github/workflows/deploy.yml`（输入 `/` 会自动变成文件夹），
   把本地 `deploy.yml` 的全部内容复制粘贴进去，点 **Commit changes**。
   这个文件负责自动发布到 GitHub Pages；只用 StackBlitz 的话可以不做。

## 四、发布成正式网址（GitHub Pages，可选）

1. 仓库 **Settings → Pages**，Source 选 **GitHub Actions**。
2. 如果第二步用的是环境变量：**Settings → Secrets and variables → Actions → New repository secret**，
   新建 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。（直接写在 `config.js` 里的可以跳过这一步。）
3. 每次推送到 `main` 分支都会自动部署，网址为 `https://<你的GitHub用户名>.github.io/birdglass-survey/`。
   在仓库 **Actions** 页可以看到部署进度。

## 本地运行

需要 Node.js 18 以上：

```bash
npm install
npm run dev      # 开发预览，终端会显示局域网地址，手机连同一 Wi-Fi 可直接打开
npm run build    # 打包到 dist/
```

---

## 评分与判级规则（与量表 Excel 公式一致）

| 项目 | 取值 | 说明 |
|---|---|---|
| A 未防护危险玻璃的面积与连续性 | 0–3，权重 ×2 | 先剔除已核实有效防护的面积 |
| B 视觉欺骗强度 | 0–3，权重 ×3 | 反射与通透取较高值，不相加 |
| C 空间构型与曲面放大 | 0–3，权重 ×2 | 曲率本身不自动加分 |
| D 鸟类暴露与吸引背景 | 0–3，权重 ×2 | 看真实环境，不看倒影 |
| 完整有效防护 | 0 / 1 | 1 时指数记为 0 |
| 夜间灯光 N | 0–3 / 空 | 空 = 未观察；N ≥ 2 只提高监测优先级 |
| 碰撞证据 | 0–2 | 1 至少“高”，2 直接“极高” |
| 明显飞穿红旗 | 0–2 | 1 至少“高”，2 直接“极高” |

- 指数分级：0–5 低｜6–11 中｜12–18 高｜19–27 极高
- 未防护且 A、B 均为 3 分：直接“极高”
- 碰撞证据或飞穿为 1 时：指数 ≥ 19 为“极高”，否则为“高”
- 建筑级风险取该建筑最高单元等级，不取平均；同级时比较高/极高单元数量

## 导出的 CSV

列顺序与量表“批量记录”表一致，另加观察者、观察类型、照片数量、照片类型、照片链接、记录ID、最后更新。
文件带 UTF-8 BOM，用 Excel 直接打开中文不会乱码。照片链接是 Supabase 的公开地址，可直接点开。

## 关于数据安全

`schema.sql` 的权限设置是“任何拿到网址的人都能读写”，方便小组成员不用登录直接录入。
不要把网址公开发到群外；比赛结束后可在 Supabase 后台把 Project 暂停或删除。

## 文件结构

```
birdglass-survey/
├── index.html         页面入口
├── main.js            量表定义、评分逻辑、界面与数据存取
├── style.css          样式（自动适配浅色/深色模式）
├── config.js          Supabase 连接设置
├── schema.sql         数据库建表与权限脚本（在 Supabase SQL Editor 运行）
├── deploy.yml         GitHub Pages 自动部署（放到仓库的 .github/workflows/ 下）
├── .stackblitzrc      StackBlitz 启动设置
├── package.json / vite.config.js
└── .env.example
```
