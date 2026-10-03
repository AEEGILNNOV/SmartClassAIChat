// DeepSeek 自动填入/发送的渲染层封装
// 实际执行在主进程（src/shared/deepseekScript.js + src/main/main.js），
// 这样主窗口和悬浮面板都能调用同一套逻辑

export async function sendToDeepSeek(text) {
  return window.api.sendToDeepSeek(text);
}

export async function fillToDeepSeek(text) {
  return window.api.fillToDeepSeek(text);
}
