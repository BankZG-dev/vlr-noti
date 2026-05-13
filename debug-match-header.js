const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    const url = 'https://www.vlr.gg/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf';
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Check match header
    const matchInfo = await page.evaluate(() => {
      const teamNames = Array.from(document.querySelectorAll('.match-header-link-name')).map(el => el.textContent?.trim());
      const scoreSpans = Array.from(document.querySelectorAll('.match-header-vs-score .js-spoiler span'));
      const score = scoreSpans.map(el => el.textContent?.trim());
      
      // Check game tabs for map names
      const tabs = Array.from(document.querySelectorAll('.vm-stats-gamesnav-item'));
      const maps = tabs.map(tab => ({
        gameId: tab.getAttribute('data-game-id'),
        text: tab.textContent?.trim(),
        children: Array.from(tab.querySelectorAll('div')).map(d => d.textContent?.trim())
      }));
      
      return {
        teamNames,
        scoreSpans: score,
        maps
      };
    });
    
    console.log('Match Info:');
    console.log('Teams:', matchInfo.teamNames);
    console.log('Score:', matchInfo.scoreSpans);
    console.log('\nMaps/Tabs:');
    matchInfo.maps.forEach((m, i) => {
      console.log(`${i}: ${m.gameId} - "${m.text}"`);
      console.log('   Children:', m.children);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
