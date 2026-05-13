const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to VLR matches page...');
    await page.goto('https://www.vlr.gg/matches', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    await page.waitForTimeout(2000);
    
    // Get page structure
    const matches = await page.evaluate(() => {
      const matches = [];
      document.querySelectorAll('.match-item').forEach((el, idx) => {
        if (idx < 5) {
          const team1 = el.querySelector('.match-item-vs-team-name:nth-of-type(1)')?.textContent?.trim();
          const team2 = el.querySelector('.match-item-vs-team-name:nth-of-type(2)')?.textContent?.trim();
          const url = el.getAttribute('href');
          const status = el.querySelector('.ml-status')?.textContent?.trim();
          
          matches.push({
            team1, team2, url, status
          });
        }
      });
      return matches;
    });
    
    console.log('Found matches:');
    matches.forEach((m, i) => {
      console.log(`${i+1}. ${m.team1} vs ${m.team2}`);
      console.log(`   URL: ${m.url}`);
      console.log(`   Status: ${m.status}`);
    });
    
    // Look for T1 vs FS match in recent results
    console.log('\n\nChecking recent results...');
    await page.goto('https://www.vlr.gg/matches/results', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const recentMatches = await page.evaluate(() => {
      const matches = [];
      document.querySelectorAll('.match-item').forEach((el, idx) => {
        if (idx < 10) {
          const team1 = el.querySelector('.match-item-vs-team-name:nth-of-type(1)')?.textContent?.trim();
          const team2 = el.querySelector('.match-item-vs-team-name:nth-of-type(2)')?.textContent?.trim();
          const url = el.getAttribute('href');
          
          if ((team1?.includes('T1') || team2?.includes('T1')) && 
              (team1?.toLowerCase().includes('full') || team2?.toLowerCase().includes('full') ||
               team1?.toLowerCase().includes('fs') || team2?.toLowerCase().includes('fs'))) {
            matches.push({
              team1, team2, url
            });
          }
        }
      });
      return matches;
    });
    
    console.log('T1 vs FS matches found:');
    recentMatches.forEach((m, i) => {
      console.log(`${i+1}. ${m.team1} vs ${m.team2}`);
      console.log(`   URL: https://vlr.gg${m.url}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
