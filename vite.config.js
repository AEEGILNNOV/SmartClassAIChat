const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');
const path = require('path');
const fs = require('fs');

// 构建完成后把应用图标复制进渲染目录，供标题栏显示
function copyIcon() {
  return {
    name: 'copy-icon',
    closeBundle() {
      const src = path.resolve(__dirname, 'build/icon.png');
      const dest = path.resolve(__dirname, 'dist-renderer/icon.png');
      if (fs.existsSync(src)) fs.copyFileSync(src, dest);
    }
  };
}

module.exports = defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react(), copyIcon()],
  build: {
    outDir: path.resolve(__dirname, 'dist-renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/renderer/index.html'),
        float: path.resolve(__dirname, 'src/renderer/float.html')
      }
    }
  }
});
