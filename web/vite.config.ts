import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 지난 배포의 화면 파일을 남겨 둔다: 예전 화면을 연 브라우저가 옛 파일을 찾아도 흰 화면이 되지 않게
    emptyOutDir: false,
    rollupOptions: {
      output: {
        // 자주 안 바뀌는 큰 라이브러리를 따로 떼어 두면 배포 후에도 휴대폰 캐시를 그대로 쓴다
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase';
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@tanstack|i18next|react-i18next)\//.test(id)) return 'vendor';
        },
      },
    },
  },
})
