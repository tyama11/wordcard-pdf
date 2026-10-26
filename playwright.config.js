import { defineConfig, devices } from '@playwright/test';

// 複数の作業を並行してテストできるよう、ポートは環境変数で変更できる
const port = Number(process.env.PW_PORT) || 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  // 位置合わせの判定を甘くしないよう、CIでも再試行はしない
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
