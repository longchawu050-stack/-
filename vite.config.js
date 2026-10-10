import { defineConfig } from 'vite';

// base: './' 让打包结果放在 GitHub Pages 的子路径（/仓库名/）下也能正常加载
export default defineConfig({
  base: './',
});
