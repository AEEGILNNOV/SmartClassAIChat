// 语音输入辅助（主窗口 / 悬浮面板共用逻辑）
//
// 使用 Chromium 的 Web Speech API（zh-CN）。
// 说明：Electron 未内置 Google 语音服务密钥，部分环境会报 network/not-allowed 错误，
// 此时 isVoiceSupported() 仍为 true 但 start 后立即 onState('error')，
// 界面会提示改用 Windows 自带语音输入（Win+H），不影响其他功能。

export function isVoiceSupported() {
  return typeof window.SpeechRecognition !== 'undefined' || typeof window.webkitSpeechRecognition !== 'undefined';
}

let active = false;
let rec = null;

/**
 * 切换语音输入
 * @param {Object} hooks
 * @param {(text:string, isFinal:boolean)=>void} hooks.onResult  识别结果（持续回调）
 * @param {(state:string)=>void} hooks.onState 'listening' | 'idle' | 'error:xxx'
 * @returns {boolean} 是否成功启动
 */
export function toggleVoice({ onResult, onState }) {
  if (active) {
    rec && rec.stop();
    return true;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    onState && onState('unsupported');
    return false;
  }
  rec = new SR();
  rec.lang = 'zh-CN';
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    let text = '';
    let isFinal = false;
    for (const r of e.results) {
      text += r[0].transcript;
      if (r.isFinal) isFinal = true;
    }
    onResult && onResult(text, isFinal);
  };
  rec.onend = () => {
    active = false;
    onState && onState('idle');
  };
  rec.onerror = (e) => {
    active = false;
    onState && onState('error:' + (e.error || 'unknown'));
  };
  try {
    rec.start();
    active = true;
    onState && onState('listening');
    return true;
  } catch {
    active = false;
    onState && onState('error:start');
    return false;
  }
}

export function voiceActive() {
  return active;
}
