import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { sendToDeepSeek, fillToDeepSeek } from './deepseekAutomation';

// ---------- 无土栽培 Prompt 模板（默认内容，可在设置页修改） ----------
const DEFAULT_PROMPTS = [
  {
    icon: '🧪',
    title: '营养液管理',
    text: `你是一名高中无土栽培课程教师助手。
请根据高中生能够理解的水平，解释营养液中的EC值和pH值分别代表什么，以及它们为什么会影响植物的正常生长。
请使用通俗语言，并结合一个简单的无土栽培实例进行解释。`
  },
  {
    icon: '📊',
    title: 'EC / pH 分析',
    text: `请作为无土栽培专家，根据以下信息分析植物可能存在的问题：

作物：
生长阶段：
EC：
pH：
症状：

请从营养、pH、EC、水分、光照等角度分析可能原因，并给出进一步观察和解决的建议。`
  },
  {
    icon: '🦠',
    title: '植物病害分析',
    text: `请根据以下植物症状分析可能原因：

作物：
症状：
叶片颜色：
根系情况：
环境：

请从营养缺乏、pH、EC、水分、光照以及病害等方面进行分析。`
  },
  {
    icon: '🔬',
    title: '实验设计',
    text: `请设计一个适合高中生进行的无土栽培实验。

要求：
1. 实验目的明确
2. 材料容易获得
3. 实验步骤清晰
4. 设置合理变量
5. 可以记录数据
6. 最终可以进行分析和讨论。`
  },
  {
    icon: '❓',
    title: '课堂问题生成',
    text: `请围绕高中无土栽培课程内容生成课堂提问。

要求：
问题具有启发性。
尽量让学生进行观察、推理、分析，而不是简单背诵知识点。`
  },
  {
    icon: '📝',
    title: '教学设计',
    text: `请帮助高中教师设计一个无土栽培课堂教学环节。

要求结合实际生产和实验，引导学生观察、分析和讨论。`
  },
  {
    icon: '🌱',
    title: '作物生长方案',
    text: `你是无土栽培技术顾问。我计划在教室/校园种植【作物名称】，周期为【周数】周，环境条件为【光照、温度情况】。
请制定完整方案：
1. 适合的栽培方式（水培/NFT/基质培）及理由；
2. 营养液配方与EC/pH管理时间表；
3. 光照、温度、通风管理要点；
4. 每周生长检查清单；
5. 常见问题与应对措施。`
  }
];

const DEEPSEEK_URL = 'https://chat.deepseek.com';

// 用户的自定义提示词（设置页修改后保存在本机 localStorage）
function loadCustomPrompts() {
  try {
    return JSON.parse(localStorage.getItem('customPrompts') || '{}');
  } catch {
    return {};
  }
}

export default function App() {
  const [tab, setTab] = useState('prompts');
  const [topActive, setTopActive] = useState(true);
  const [toast, setToast] = useState('');
  const [selected, setSelected] = useState(0);
  const [customPrompts, setCustomPrompts] = useState(loadCustomPrompts);
  const [drafts, setDrafts] = useState(customPrompts); // 设置页的编辑草稿

  // 合并默认模板与用户自定义内容
  const prompts = DEFAULT_PROMPTS.map((p) => ({
    ...p,
    text: typeof customPrompts[p.title] === 'string' ? customPrompts[p.title] : p.text
  }));

  // 比赛模式：首次启动显示开始页
  const [started, setStarted] = useState(() => localStorage.getItem('competitionStarted') === '1');

  // 分享二维码
  const [shareLink, setShareLink] = useState('');
  const [shareNote, setShareNote] = useState('');
  const [qrImg, setQrImg] = useState('');
  const [savedPath, setSavedPath] = useState('');

  // 教学记录
  const [records, setRecords] = useState([]);

  const webviewRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };

  const refreshRecords = async () => {
    setRecords(await window.api.listRecords());
  };

  useEffect(() => {
    refreshRecords();
    return () => clearTimeout(toastTimer.current);
  }, []);

  // ---------- 比赛模式 ----------
  const startCompetition = async () => {
    localStorage.setItem('competitionStarted', '1');
    setStarted(true);
    await window.api.showFloating(); // 显示悬浮按钮
    await window.api.hideWindow();   // 主窗口退到后台，需要时点悬浮球打开
  };

  // ---------- Prompt 复制（同时自动填入 DeepSeek 输入框，不发送） ----------
  const copyPrompt = async (p) => {
    await window.api.copyPrompt(p.text);
    const res = await fillToDeepSeek(p.text);
    if (res.ok) {
      showToast('已复制并填入 DeepSeek 输入框，按回车即可发送');
      return;
    }
    showToast('Prompt 已复制');
  };

  // ---------- 发送到 DeepSeek（填入 + 自动发送） ----------
  const sendPrompt = async (p) => {
    showToast('正在发送到 DeepSeek…');
    const res = await sendToDeepSeek(p.text);
    if (res.ok) {
      showToast('已发送，DeepSeek 正在回答');
    } else if (res.reason === 'filled') {
      showToast('已填入输入框但未自动发送，请按回车发送');
    } else if (res.reason === 'no-webview' || res.reason === 'loading') {
      showToast('请先打开 DeepSeek（右侧页面加载完成后再试）。');
    } else {
      showToast('自动填写失败，请点击复制 Prompt 后手动粘贴。');
    }
  };

  const sendToDeepSeekNow = () => sendPrompt(prompts[selected]);

  // ---------- 设置：编辑提示词 ----------
  const saveSettings = () => {
    localStorage.setItem('customPrompts', JSON.stringify(drafts));
    setCustomPrompts(drafts);
    showToast('提示词设置已保存');
  };

  const resetSettings = () => {
    localStorage.removeItem('customPrompts');
    setDrafts({});
    setCustomPrompts({});
    showToast('已恢复默认提示词');
  };

  // ---------- 分享二维码 ----------
  const generateQr = async () => {
    const link = shareLink.trim();
    if (!link) {
      showToast('请先输入 DeepSeek 分享链接。');
      return;
    }
    if (!/^https:\/\/chat\.deepseek\.com\/(share|a)\//.test(link)) {
      showToast('请输入有效的 DeepSeek 分享链接。');
      return;
    }
    try {
      const dataURL = await QRCode.toDataURL(link, {
        width: 260,
        margin: 2,
        color: { dark: '#065f46', light: '#ffffff' }
      });
      setQrImg(dataURL);
      setSavedPath('');
      await window.api.addRecord({ note: shareNote.trim() || '（无备注）', link });
      await refreshRecords();
      showToast('二维码已生成，记录已保存');
    } catch (err) {
      showToast('二维码生成失败：' + err.message);
    }
  };

  const saveQr = async () => {
    if (!qrImg) return;
    const res = await window.api.saveQr(qrImg);
    if (res && res.ok) {
      setSavedPath(res.path);
      showToast('二维码已保存到桌面');
    } else {
      showToast('二维码保存失败：' + (res && res.message ? res.message : '未知错误'));
    }
  };

  const deleteRecord = async (id) => {
    await window.api.deleteRecord(id);
    await refreshRecords();
  };

  const copyLink = async (link) => {
    await window.api.copyPrompt(link);
    showToast('链接已复制');
  };

  const toggleTop = async () => {
    const on = await window.api.toggleTop();
    setTopActive(on);
    showToast(on ? '已置顶' : '已取消置顶');
  };

  // ---------- 比赛模式开始页 ----------
  if (!started) {
    return (
      <div className="start-screen">
        <div className="start-card">
          <div className="start-logo">🌱</div>
          <h1 className="start-title">无土栽培智能教学助手</h1>
          <p className="start-sub">课堂 AI 教学助手 · 内嵌 DeepSeek · 一键提问 · 分享二维码</p>
          <button className="start-btn" onClick={startCompetition}>开始使用 AI</button>
          <p className="start-tip">点击后将显示桌面悬浮按钮，点击悬浮球 🌱 随时打开助手</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* 自定义标题栏（可拖动区域） */}
      <div className="titlebar">
        <div className="titlebar-left">
          <img className="logo" src="./icon.png" alt="" onError={(e) => { e.target.style.display = 'none'; }} />
          <span className="app-name">🌿 无土栽培AI助手</span>
        </div>
        <div className="titlebar-btns">
          <button className="tb-btn" title="显示/隐藏桌面悬浮按钮" onClick={async () => { await window.api.toggleFloating(); showToast('悬浮按钮已切换'); }}>🌱</button>
          <button className="tb-btn" title="置顶/取消置顶" onClick={toggleTop}>{topActive ? '📌' : '📍'}</button>
          <button className="tb-btn" title="最小化" onClick={() => window.api.minimizeWindow()}>—</button>
          <button className="tb-btn" title="最大化/还原" onClick={() => window.api.maximizeWindow()}>▢</button>
          <button className="tb-btn" title="隐藏窗口（Ctrl+Alt+A 可再次显示）" onClick={() => window.api.hideWindow()}>👁</button>
          <button className="tb-btn tb-close" title="退出" onClick={() => window.api.quitApp()}>✕</button>
        </div>
      </div>

      <div className="body">
        {/* 侧边栏 */}
        <aside className="sidebar">
          <nav className="tabs">
            <button className={tab === 'prompts' ? 'tab active' : 'tab'} onClick={() => setTab('prompts')}>💡 Prompt</button>
            <button className={tab === 'share' ? 'tab active' : 'tab'} onClick={() => setTab('share')}>🔗 二维码</button>
            <button className={tab === 'records' ? 'tab active' : 'tab'} onClick={() => setTab('records')}>📚 记录</button>
            <button className={tab === 'settings' ? 'tab active' : 'tab'} onClick={() => setTab('settings')}>⚙️ 设置</button>
          </nav>

          {tab === 'prompts' && (
            <div className="panel">
              <p className="panel-tip">先点击选择一个 Prompt，再点下方大按钮；每个 Prompt 右侧有「复制」「发送」快捷按钮。</p>
              {prompts.map((p, i) => (
                <div key={p.title} className={i === selected ? 'prompt-item selected' : 'prompt-item'}>
                  <button className="prompt-btn" onClick={() => setSelected(i)}>
                    <span className="p-icon">{p.icon}</span>
                    <span className="p-title">{p.title}</span>
                  </button>
                  <span className="chips">
                    <button className="copy-chip" title="复制并填入输入框（不发送）" onClick={() => copyPrompt(p)}>复制</button>
                    <button className="copy-chip send" title="填入并自动发送" onClick={() => sendPrompt(p)}>发送</button>
                  </span>
                </div>
              ))}

              <div className="big-actions">
                <button className="action-btn primary" onClick={sendToDeepSeekNow}>🚀 发送到 DeepSeek</button>
                <button className="action-btn" onClick={() => copyPrompt(prompts[selected])}>📋 复制 Prompt</button>
              </div>
              <div className="panel-foot">
                发送失败时用「复制 Prompt」+ Ctrl+V 粘贴到 DeepSeek 即可。提示词可在「设置」页修改。
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="panel">
              <p className="panel-tip">在这里修改每个提示词的内容（例如把说明改成更适合你课堂的版本），保存在本机。</p>
              {prompts.map((p) => (
                <div key={p.title} className="setting-item">
                  <label className="field-label">{p.icon} {p.title}</label>
                  <textarea
                    className="field setting-text"
                    rows={5}
                    value={typeof drafts[p.title] === 'string' ? drafts[p.title] : p.text}
                    onChange={(e) => setDrafts({ ...drafts, [p.title]: e.target.value })}
                  />
                </div>
              ))}
              <div className="big-actions">
                <button className="action-btn primary" onClick={saveSettings}>💾 保存设置</button>
                <button className="action-btn" onClick={resetSettings}>↩️ 恢复默认提示词</button>
              </div>
            </div>
          )}

          {tab === 'share' && (
            <div className="panel">
              <p className="panel-tip">在 DeepSeek 中点「分享」复制链接，粘贴到下面生成二维码，裁判扫码即可查看对话。</p>
              <label className="field-label">DeepSeek 分享链接</label>
              <input
                className="field"
                placeholder="https://chat.deepseek.com/share/..."
                value={shareLink}
                onChange={(e) => setShareLink(e.target.value)}
              />
              <label className="field-label">备注（可选）</label>
              <input
                className="field"
                placeholder="如：生菜EC对比实验课"
                value={shareNote}
                onChange={(e) => setShareNote(e.target.value)}
              />
              <button className="primary-btn" onClick={generateQr}>生成二维码</button>

              {qrImg && (
                <div className="qr-box">
                  <img src={qrImg} alt="分享二维码" className="qr-img" />
                  <button className="secondary-btn" onClick={saveQr}>保存二维码</button>
                  {savedPath && <p className="saved-path">已保存：{savedPath}</p>}
                </div>
              )}
            </div>
          )}

          {tab === 'records' && (
            <div className="panel">
              <p className="panel-tip">仅保存时间、备注与分享链接，保存在本机，不保存任何登录信息。</p>
              {records.length === 0 && <p className="empty">暂无记录，快去生成一个分享二维码吧。</p>}
              {records.map((r) => (
                <div key={r.id} className="record">
                  <div className="r-head">
                    <span className="r-time">{r.time}</span>
                    <span className="r-actions">
                      <button className="mini-btn" onClick={() => copyLink(r.link)}>复制链接</button>
                      <button className="mini-btn danger" onClick={() => deleteRecord(r.id)}>删除</button>
                    </span>
                  </div>
                  <div className="r-note">{r.note}</div>
                  <div className="r-link" title={r.link}>{r.link}</div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* DeepSeek 网页区 */}
        <div className="web-wrap">
          <div className="web-toolbar">
            <span className="web-label">DeepSeek AI</span>
            <button className="mini-btn" onClick={() => webviewRef.current && webviewRef.current.reload()}>刷新页面</button>
          </div>
          <webview
            ref={webviewRef}
            id="deepseek"
            src={DEEPSEEK_URL}
            partition="persist:deepseek"
            allowpopups="true"
          />
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
