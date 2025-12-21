import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import aireview from 'aireview/vite'

export default defineConfig(({ mode }) => {
  // 加载 .env.dev 文件中的环境变量
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [
      vue(),
      aireview()
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'process.env': {}
    },
    // 指定 env 文件目录
    envDir: '.',
  }
})
