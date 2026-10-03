// DeepSeek 页面自动填入与发送（集中管理，网页改版时只改这个文件）
//
// 原则：
// - 只做最基本的操作：定位输入框 → 写入 Prompt → （可选）触发发送
// - 不读取 Cookie / 密码 / Token / 用户数据
// - 任何失败都返回 { ok: false, reason }，由调用方提示用户手动粘贴，不影响软件运行

const LOAD_TIMEOUT_MS = 15000;

// 等待 webview 页面加载完成（最多 LOAD_TIMEOUT_MS）
async function waitLoaded(webview) {
  const start = Date.now();
  while (webview.isLoading()) {
    if (Date.now() - start > LOAD_TIMEOUT_MS) return false;
    await new Promise((r) => setTimeout(r, 400));
  }
  return true;
}

// 注入页面的脚本：定位输入框并写入 Prompt；autoSend=true 时再触发回车发送
function buildScript(text, autoSend) {
  const json = JSON.stringify(text);
  return `(() => {
  try {
    const TEXT = ${json};
    const AUTO_SEND = ${autoSend ? 'true' : 'false'};
    // 1. 定位输入框：优先 DeepSeek 的聊天输入框，其次任意 textarea，最后富文本框
    const ta = document.querySelector('textarea#chat-input') || document.querySelector('textarea');
    const box = ta || document.querySelector('div[contenteditable="true"]');
    if (!box) return { ok: false, reason: 'no-input' };

    // 2. 写入 Prompt（兼容 React 受控组件的写法）
    if (ta) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, TEXT);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      box.innerText = TEXT;
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }
    box.focus();

    // 只填入不发送：到这里结束
    if (!AUTO_SEND) return { ok: true, reason: 'filled' };

    // 3. 触发发送（模拟回车）
    const enter = new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
      bubbles: true, cancelable: true
    });
    box.dispatchEvent(enter);

    // 4. 通过输入框是否被清空判断是否发送成功
    return new Promise((resolve) => {
      setTimeout(() => {
        const empty = ta ? ta.value.trim() === '' : box.innerText.trim() === '';
        resolve(empty ? { ok: true } : { ok: false, reason: 'filled' });
      }, 900);
    });
  } catch (err) {
    return { ok: false, reason: 'error', message: String(err && err.message) };
  }
})();`;
}

// 在指定 webview 中执行脚本（统一处理加载等待与 URL 校验）
async function runInDeepSeek(webview, script) {
  if (!webview) return { ok: false, reason: 'no-webview' };
  const loaded = await waitLoaded(webview);
  if (!loaded) return { ok: false, reason: 'loading' };

  const url = webview.getURL() || '';
  if (!url.includes('chat.deepseek.com')) return { ok: false, reason: 'no-webview' };

  const result = await webview.executeJavaScript(script, true);
  return result || { ok: false, reason: 'error' };
}

/**
 * 只把 Prompt 填入 DeepSeek 输入框，不发送（教师自己按回车）
 * @returns {Promise<{ok:boolean, reason?:string, message?:string}>}
 */
export async function fillToDeepSeek(webview, text) {
  try {
    return await runInDeepSeek(webview, buildScript(text, false));
  } catch (err) {
    return { ok: false, reason: 'error', message: err.message };
  }
}

/**
 * 把 Prompt 填入 DeepSeek 输入框并自动发送
 * @returns {Promise<{ok:boolean, reason?:string, message?:string}>}
 *   ok=true            已填入并成功发送
 *   reason='filled'    已填入但未能自动发送（用户按回车即可）
 *   reason='no-input'  页面上找不到输入框（未登录/非对话页/改版）
 *   reason='loading'   页面加载超时
 *   reason='error'     其他异常
 */
export async function sendToDeepSeek(webview, text) {
  try {
    return await runInDeepSeek(webview, buildScript(text, true));
  } catch (err) {
    return { ok: false, reason: 'error', message: err.message };
  }
}
