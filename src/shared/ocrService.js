// PPT 截图/图片 OCR 识别 + 上下文分析 —— 预留接口（尚未实现）
//
// 规划：后续接入本地 OCR（如 PaddleOCR / Tesseract WASM）后，
// 在此模块实现 analyzeImage，主进程 IPC 'ocr:analyze' 已就绪，
// 渲染层通过 window.api.ocrAnalyze(payload) 调用即可，无需再改其他层。
//
// 预期 payload: { image: <dataURL 或本地图片路径>, question?: <结合上下文的提问> }
// 预期返回:     { ok: true, text: <识别文字>, context: <上下文分析> }

async function analyzeImage(_payload) {
  return {
    ok: false,
    ready: false,
    message: 'OCR 识别功能预留接口，尚未启用'
  };
}

module.exports = { analyzeImage };
