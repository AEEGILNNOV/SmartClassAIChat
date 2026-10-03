// 纯 Node.js 生成应用图标（PNG/ICO），不依赖任何第三方库
// 用法: node scripts/gen-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- PNG 编码 ----------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- 绘制：圆角渐变绿底 + 白色幼苗 ----------
function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const m = size * 0.04;          // 边距
  const r = size * 0.22;          // 圆角半径
  const c1 = [52, 211, 153];      // #34d399
  const c2 = [5, 150, 105];       // #059669

  const inRoundedRect = (x, y) => {
    if (x < m || x > size - m || y < m || y > size - m) return false;
    const cx = Math.min(Math.max(x, m + r), size - m - r);
    const cy = Math.min(Math.max(y, m + r), size - m - r);
    return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
  };

  const inEllipse = (x, y, cx, cy, a, b, deg) => {
    const t = (deg * Math.PI) / 180;
    const dx = x - cx, dy = y - cy;
    const rx = dx * Math.cos(t) + dy * Math.sin(t);
    const ry = -dx * Math.sin(t) + dy * Math.cos(t);
    return (rx * rx) / (a * a) + (ry * ry) / (b * b) <= 1;
  };

  const stemW = size * 0.035;
  const stemTop = size * 0.42, stemBot = size * 0.82;
  const mid = size / 2;
  const leafA = size * 0.17, leafB = size * 0.08;
  const leafY = size * 0.36;
  const forkY = size * 0.48;

  const sample = (x, y) => {
    if (!inRoundedRect(x, y)) return 0;
    if (x > mid - stemW / 2 && x < mid + stemW / 2 && y > stemTop && y < stemBot) return 1;
    if (inEllipse(x, y, size * 0.345, leafY, leafA, leafB, -38)) return 1;
    if (inEllipse(x, y, size * 0.655, leafY, leafA, leafB, 38)) return 1;
    // 叶柄：从主茎顶端向两片叶子分开
    const dx = Math.abs(x - mid);
    if (y > stemTop && y < forkY) {
      const spread = ((y - stemTop) / (forkY - stemTop)) * size * 0.16 + stemW / 2;
      if (dx < spread) return 1;
    }
    return 0;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 2x2 超采样抗锯齿
      let acc = 0;
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        acc += sample(x + ox, y + oy);
      }
      const fg = acc / 4;
      const i = (y * size + x) * 4;
      const t = (x + y) / (2 * size);
      let R = c1[0] + (c2[0] - c1[0]) * t;
      let G = c1[1] + (c2[1] - c1[1]) * t;
      let B = c1[2] + (c2[2] - c1[2]) * t;
      R = R * (1 - fg) + 255 * fg;
      G = G * (1 - fg) + 255 * fg;
      B = B * (1 - fg) + 255 * fg;
      px[i] = Math.round(R);
      px[i + 1] = Math.round(G);
      px[i + 2] = Math.round(B);
      px[i + 3] = 255;
    }
  }
  return px;
}

// ---------- ICO 封装（内嵌 256px PNG，Win10/11 支持） ----------
function pngToIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = 0;  // width 256
  entry[1] = 0;  // height 256
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);  // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12); // offset
  return Buffer.concat([header, entry, png]);
}

const outDir = path.resolve(__dirname, '../build');
fs.mkdirSync(outDir, { recursive: true });

const png256 = encodePng(256, 256, render(256));
fs.writeFileSync(path.join(outDir, 'icon.png'), png256);
fs.writeFileSync(path.join(outDir, 'icon.ico'), pngToIco(png256));
fs.writeFileSync(path.join(outDir, 'tray.png'), encodePng(32, 32, render(32)));

console.log('图标已生成: build/icon.png, build/icon.ico, build/tray.png');
