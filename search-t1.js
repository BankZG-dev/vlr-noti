const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Search for T1
    console.log('Searching for T1...');
    await page.goto('https://www.vlr.gg/search/?q=T1&type=teams', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const teamResults = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('.wf-module-item').forEach((el, idx) => {
        if (idx < 5) {
          const name = el.querySelector('.wf-module-item-name')?.textContent?.trim() || el.textContent?.trim();
          const href = el.getAttribute('href');
          results.push({ name, href });
        }
      });
      return results;
    });
    
    console.log('Search results for T1:');
    teamResults.forEach((r, i) => {
      console.log(`${i+1}. ${r.name} - ${r.href}`);
    });
    
    // Go to T1 team page if found
    if (teamResults.length > 0) {
      const t1Href = teamResults[0].href;
      console.log(`\nGoing to: https://vlr.gg${t1Href}`);
      await page.goto(`https://vlr.gg${t1Href}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      // Look for recent matches
      const matches = await page.evaluate(() => {
        const matches = [];
        document.querySelectorAll('.match-item').forEach((el, idx) => {
          if (idx < 5) {
            const team1 = el.querySelector('.match-item-vs-team-name:nth-of-type(1)')?.textContent?.trim();
            const team2 = el.querySelector('.match-item-vs-team-name:nth-of-type(2)')?.textContent?.trim();
            const url = el.getAttribute('href');
            const score1 = el.querySelector('.match-item-vs-team-score:nth-of-type(1)')?.textContent?.trim();
            const score2 = el.querySelector('.match-item-vs-team-score:nth-of-type(2)')?.textContent?.trim();
            matches.push({ team1, team2, url, score1, score2 });
          }
        });
        return matches;
      });
      
      console.log('\nRecent matches for T1:');
      matches.forEach((m, i) => {
        console.log(`${i+1}. ${m.team1} ${m.score1} - ${m.score2} ${m.team2}`);
        console.log(`   URL: https://vlr.gg${m.url}`);
      });
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
