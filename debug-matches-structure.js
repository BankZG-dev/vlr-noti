const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Testing matches page...');
    await page.goto('https://www.vlr.gg/matches', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Save the HTML to inspect
    const html = await page.content();
    fs.writeFileSync('matches-page-debug.html', html);
    console.log(`Matches page saved (${html.length} bytes)`);
    
    // Check specific elements
    const elements = await page.evaluate(() => {
      return {
        match_items: document.querySelectorAll('.match-item').length,
        vs_team_names: document.querySelectorAll('.match-item-vs-team-name').length,
        first_match_html: document.querySelector('.match-item')?.outerHTML?.substring(0, 500),
        all_divs_with_match: document.querySelectorAll('div[class*="match"]').length,
      };
    });
    
    console.log('Elements found:', elements);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
