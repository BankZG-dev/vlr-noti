const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('response', response => {
    console.log(response.url(), response.status());
  });
  
  try {
    const response = await page.goto('https://www.vlr.gg/match/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf', { waitUntil: 'domcontentloaded' });
    console.log('Final status:', response?.status());
    
    const title = await page.title();
    console.log('Page title:', title);
    
    const bodyText = await page.textContent('body');
    console.log('Body text length:', bodyText?.length);
    console.log('Body text preview:', bodyText?.slice(0, 500));
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  await browser.close();
})();