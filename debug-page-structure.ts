import { chromium } from 'playwright';
import * as fs from 'fs';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to match page...');
    await page.goto('https://www.vlr.gg/match/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('Waiting for content to render...');
    await page.waitForTimeout(3000);
    
    // Get page content
    const content = await page.content();
    fs.writeFileSync('debug-page-full.html', content);
    console.log(`Page HTML saved (${content.length} bytes)`);
    
    // Extract using JavaScript (executes in browser context)
    const pageInfo = await page.evaluate(() => {
      const info: any = {};
      
      // Check for team names
      info.teamNames = Array.from(document.querySelectorAll('.match-header-link-name')).map(el => el.textContent?.trim());
      
      // Check for series score
      const scoreSpans = Array.from(document.querySelectorAll('.match-header-vs-score .js-spoiler span'));
      info.scoreElements = scoreSpans.length;
      info.scoreText = scoreSpans.map(el => el.textContent?.trim());
      
      // Check for game tabs
      info.gameTabs = document.querySelectorAll('.vm-stats-gamesnav-item').length;
      
      // Check for game panels
      info.gamePanels = document.querySelectorAll('.vm-stats-game').length;
      
      // Check for tables
      info.tables = document.querySelectorAll('.wf-table-inset.mod-overview').length;
      info.statsGames = document.querySelectorAll('.vm-stats-game').length;
      
      // Try alternative selectors
      info.allTables = document.querySelectorAll('table').length;
      info.statsContainers = document.querySelectorAll('[class*="stats"]').length;
      
      // Check headers
      info.headers = Array.from(document.querySelectorAll('h1, h2, h3')).map(el => el.textContent?.trim()).slice(0, 5);
      
      return info;
    });
    
    console.log('\n=== Page Structure ===');
    console.log('Team Names:', pageInfo.teamNames);
    console.log('Score Elements:', pageInfo.scoreElements);
    console.log('Score Text:', pageInfo.scoreText);
    console.log('Game Tabs:', pageInfo.gameTabs);
    console.log('Game Panels:', pageInfo.gamePanels);
    console.log('Tables found:', pageInfo.tables);
    console.log('Stats Games:', pageInfo.statsGames);
    console.log('All Tables:', pageInfo.allTables);
    console.log('Stats Containers:', pageInfo.statsContainers);
    console.log('Headers:', pageInfo.headers);
    
    // Check if page loaded successfully
    const title = await page.title();
    console.log('Page Title:', title);
    
    // Get actual content preview
    const bodyText = await page.evaluate(() => document.body.textContent?.substring(0, 500));
    console.log('Body preview:', bodyText);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
