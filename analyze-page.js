const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('https://www.vlr.gg/match/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf', { waitUntil: 'networkidle' });
  
  // Wait longer for content
  await page.waitForTimeout(5000);
  
  // Try to find ANY elements on the page
  const allElements = await page.evaluate(() => {
    return {
      bodyText: document.body.textContent?.slice(0, 500),
      htmlLength: document.documentElement.outerHTML.length,
      matches: document.querySelectorAll('*').length,
      mainContent: document.querySelector('main')?.textContent?.slice(0, 300),
      divCount: document.querySelectorAll('div').length,
      formElements: {
        h1: document.querySelectorAll('h1').length,
        h2: document.querySelectorAll('h2').length,
        span: document.querySelectorAll('span').length,
        a: document.querySelectorAll('a').length
      }
    };
  });
  
  console.log('Page content analysis:');
  console.log(JSON.stringify(allElements, null, 2));
  
  const html = await page.content();
  console.log('\nHTML length:', html.length);
  console.log('First 1000 chars:', html.slice(0, 1000));
  
  await browser.close();
})();