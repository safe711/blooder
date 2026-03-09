# 并行代码工作流

## 稳定体验入口
- `STYLE_PREVIEW.html`
  - 永远读取 `code/stable/*.js`
  - 用于随时稳定游玩/回归

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

