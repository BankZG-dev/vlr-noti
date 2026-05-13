const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    const url = 'https://www.vlr.gg/match/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf';
    console.log(`Testing URL: ${url}\n`);
    
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Response status:', response?.status());
    console.log('Response ok:', response?.ok());
    
    await page.waitForTimeout(2000);
    
    const html = await page.content();
    fs.writeFileSync('match-page-debug.html', html);
    console.log(`Match page saved (${html.length} bytes)`);
    
    // Check for content
    const info = await page.evaluate(() => {
      return {
        title: document.title,
        body_length: document.body.textContent?.length,
        match_headers: document.querySelectorAll('.match-header-link-name').length,
        vm_stats_game: document.querySelectorAll('.vm-stats-game').length,
        has_content: document.body.textContent?.length > 100,
      };
    });
    
    console.log('Page info:', info);
    
    // Show first 1000 chars of body
    const bodyPreview = await page.evaluate(() => document.body.textContent?.substring(0, 1000));
    console.log('\nBody preview:\n', bodyPreview);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
