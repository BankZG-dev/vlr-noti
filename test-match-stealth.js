const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Add stealth to avoid bot detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });
  
  try {
    const url = 'https://www.vlr.gg/match/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf';
    console.log(`Testing with stealth: ${url}\n`);
    
    // Add request/response logging
    page.on('response', response => {
      console.log(`${response.request().method()} ${response.status()} ${response.url()}`);
    });
    
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('\nFinal response status:', response?.status());
    
    await page.waitForTimeout(3000);
    
    const info = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        body_length: document.body.textContent?.length,
        body_html_length: document.body.innerHTML.length,
        has_html: document.body.innerHTML.length > 100,
      };
    });
    
    console.log('Page info:', info);
    
    // Check if redirected
    if (info.url !== url) {
      console.log('WARNING: Redirected to different URL!');
    }
    
    // Try to get more info about what's on the page
    const scripts = await page.evaluate(() => document.querySelectorAll('script').length);
    console.log('Number of script tags:', scripts);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
