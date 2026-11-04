import { test, expect } from '@playwright/test';

const SITE_URL = 'https://tyama11.github.io/wordcard-pdf/';

test.describe('検索エンジン向けの情報', () => {
  test('タイトル、説明文、正規URLが設定されている', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/単語カード.*CSV.*両面印刷/);

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toContain('単語カード');
    // 検索結果で主要な内容が切り捨てられないよう、長くなりすぎないようにする
    expect(description.length).toBeLessThanOrEqual(140);

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', SITE_URL);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', SITE_URL);
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('構造化データが正しいJSONで、公開URLを指している', async ({ page }) => {
    await page.goto('/');
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const data = JSON.parse(raw);
    expect(data['@type']).toBe('WebApplication');
    expect(data.url).toBe(SITE_URL);
    expect(data.isAccessibleForFree).toBe(true);
  });

  test('サイトマップが公開URLを含む', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain(`<loc>${SITE_URL}</loc>`);
  });
});
