# 并行代码工作流

## 稳定体验入口
- `STYLE_PREVIEW.html`
  - 永远读取 `code/stable/*.js`
  - 用于随时稳定游玩/回归

## 主角配置文件
- `code/stable/05_heroes.js`（稳定版运行时配置）
- `code/threads/thread_*/05_heroes.js`（线程版运行时配置）
- `code/config/heroes.json`（主配置，按 `heroId` 区分）

每个主角都支持以下属性字段（`attributes`）：
- `attack`：攻击（基础值）
- `shot_interval_ms`：射击间隔（毫秒，越小越快）
- `bullet_speed`：弹道速度
- `bullet_count`：子弹数量
- `bullet_spread_deg`：子弹散射角
- `move_speed`：移动速度（基础值）
- `hp`：生命值（基础值）
- `portrait_id_a`：大头像ID A（选角界面）
- `portrait_id_b`：大头像ID B（选角界面）
- `portrait_file_a`：大头像文件 A（例如 `art/hero/johney.png`）
- `portrait_file_b`：大头像文件 B（例如 `art/hero/生成特定风格角色.png`）
- `passives`：被动效果数组（可多个，`id + desc`）

`heroes.json` 额外支持：
- `name`：名称
- `gender`：性别
- `initialWeaponId`：初始武器ID
- `portraitAssets`：头像ID到图片路径映射（推荐）
- `portraitCatalog.hero`：`art/hero` 下可用图片列表

## 选角界面说明
- 左侧：直接显示游戏内像素小人卡片
- 鼠标悬停：右侧切换该角色大头像
- 右侧头像画布尺寸：`800x500`
- 点击角色卡片：直接进入游戏

## 多线程入口（默认已创建）
- `STYLE_PREVIEW_THREAD_A.html` -> `code/threads/thread_A/*.js`
- `STYLE_PREVIEW_THREAD_B.html` -> `code/threads/thread_B/*.js`
- `STYLE_PREVIEW_THREAD_C.html` -> `code/threads/thread_C/*.js`

这三套代码互不覆盖，可并行修改。

## 持续新增线程（推荐）
运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\new_thread_workspace.ps1 -Name feat_xxx
```

它会：
1. 从 `code/stable` 拷贝一份新线程代码（带时间戳目录）
2. 自动生成对应的独立入口 `STYLE_PREVIEW_THREAD_<name>-<time>.html`
3. 保证不会覆盖已有线程目录

## 合并到稳定版
当某线程验证通过后，把该线程的 `00_core.js / 05_heroes.js / 10_world.js / 20_systems.js` 复制到 `code/stable/`，然后用 `STYLE_PREVIEW.html` 进行回归测试。
