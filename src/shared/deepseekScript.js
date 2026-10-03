// DeepSeek 页面自动化脚本模板（主进程与渲染层共享，网页改版时只改这个文件）
//
// 原则：
// - 只做最基本的操作：定位输入框 → 写入 Prompt → （可选）触发发送
// - 不读取 Cookie / 密码 / Token / 用户数据
// - 脚本在 DeepSeek 页面内执行，任何异常都返回 { ok: false, reason }，不崩溃

function buildDeepSeekScript(text, autoSend) {
  const json = JSON.stringify(String(text || ''));
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

module.exports = { buildDeepSeekScript, buildDeepSeekAnswerScript };

// 读取 DeepSeek 页面中最新一条回答的文本（用于悬浮窗流式显示）
// 只读取回答区域文字，不涉及 Cookie/密码/用户其他数据
function buildDeepSeekAnswerScript() {
  return `(() => {
  try {
    // DeepSeek 回答区域的 markdown 容器；类名变化时优先改这里
    let nodes = document.querySelectorAll('.ds-markdown');
    if (!nodes.length) nodes = document.querySelectorAll('[class*="markdown"]');
    const node = nodes.length ? nodes[nodes.length - 1] : null;
    return { ok: true, text: node ? node.innerText : '' };
  } catch (err) {
    return { ok: false, message: String(err && err.message) };
  }
})();`;
}
