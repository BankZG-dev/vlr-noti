import { chromium } from 'playwright';
import * as fs from 'fs';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://www.vlr.gg/match/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const content = await page.content();
  
  // Save to file for inspection
  fs.writeFileSync('page-source.html', content);
  console.log('Page HTML saved to page-source.html');
  
  // Check for key elements
  const teamNames = await page.evaluate(() => {
    const els = document.querySelectorAll('.match-header-link-name');
    return Array.from(els).map(el => el.textContent?.trim());
  });
  console.log('Team names:', teamNames);
  
  const statsGames = await page.evaluate(() => document.querySelectorAll('.vm-stats-game').length);
  console.log('Stats games found:', statsGames);
  
  const vmNavItems = await page.evaluate(() => document.querySelectorAll('.vm-stats-gamesnav-item').length);
  console.log('VM nav items found:', vmNavItems);
  
  await browser.close();
})();