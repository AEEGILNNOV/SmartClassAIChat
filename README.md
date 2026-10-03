# 智慧AI课堂助手

一个面向高中课堂的桌面 AI 教学助手：内嵌 DeepSeek 网页版，配合无土栽培专用 Prompt 快捷按钮、分享二维码生成和本地教学记录。无需自建服务器，不依赖 AI 接口密钥。

## 功能

- **桌面悬浮助手**：无边框窗口、始终置顶、可拖动、可调整大小、可隐藏（托盘或 `Ctrl+Alt+A` 恢复显示）
- **内嵌 DeepSeek**：内置网页客户端，登录状态保存在本机，下次启动无需重新登录
- **Prompt 助手**：一键复制 5 类无土栽培教学提示词（病害分析 / EC·pH 分析 / 实验设计 / 生长方案 / 课堂问题）
- **分享二维码**：粘贴 DeepSeek 分享链接即可生成二维码，可保存 PNG 到本地
- **本地记录**：仅保存时间、备注、分享链接（JSON 文件，不保存任何登录信息）

## 开发

```bash
npm install        # 安装依赖
npm run dev        # 构建界面并启动应用
npm run dist       # 打包 Windows 安装程序
```

环境要求：Node.js 18+。打包 Windows exe 需要在 Windows 上直接运行，或在 Linux/WSL 上安装 wine（本项目在 WSL2 + 便携版 wine 下打包成功）。

打包产物：`dist/智慧AI课堂助手 Setup.exe`（Windows 10/11 双击安装，目标机器无需 Node.js）。

## 使用流程

1. 启动软件，首次使用在右侧 DeepSeek 页面登录（手机号/微信）。
2. 左侧点击需要的 Prompt 按钮（提示词自动复制），把【】中的内容替换为实际信息。
3. 在 DeepSeek 输入框按 `Ctrl+V` 粘贴发送。
4. 需要分享对话时：在 DeepSeek 中生成分享链接 → 左侧「分享二维码」粘贴链接 → 生成二维码 → 保存或投屏让学生扫码。

## 项目结构

```
src/main/          Electron 主进程（窗口、托盘、IPC、本地记录）
src/renderer/      React 渲染层（侧边栏、二维码、记录列表）
src/main/preload.js  contextBridge 安全桥接
scripts/gen-icon.js  纯 Node 图标生成（无需图像工具）
build/             应用图标
dist/              打包输出
```
