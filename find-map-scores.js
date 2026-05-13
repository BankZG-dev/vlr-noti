const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    const url = 'https://www.vlr.gg/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf';
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Look for map scores in tabs and tables
    const mapScores = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.vm-stats-gamesnav-item'));
      
      const scores = [];
      tabs.forEach((tab, idx) => {
        const gameId = tab.getAttribute('data-game-id');
        if (gameId === 'all') return;
        
        const tabText = tab.textContent?.trim();
        
        // Look for score in tab
        const scoreInTab = tab.querySelector('.vm-stats-gamesnav-item-score')?.textContent?.trim();
        
        // Look for score in headers
        const gamePanel = document.querySelector(`.vm-stats-game[data-game-id="${gameId}"]`);
        if (!gamePanel) return;
        
        // Check table headers for team scores
        const tables = gamePanel.querySelectorAll('.wf-table-inset.mod-overview');
        const scoreInfo = [];
        
        tables.forEach((table, tIdx) => {
          const thead = table.querySelector('thead tr');
          if (!thead) return;
          
          // Look for score elements in header
          const teamName = thead.querySelector('.team-name')?.textContent?.trim();
          const teamScore = thead.querySelector('.team-score')?.textContent?.trim();
          const teamScoreAlt = thead.textContent?.trim().split('\n').find(line => /^\d+$/.test(line));
          
          scoreInfo.push({
            table: tIdx,
            name: teamName,
            score: teamScore,
            scoreAlt: teamScoreAlt
          });
        });
        
        scores.push({
          tabIndex: idx,
          gameId,
          tabText: tabText?.substring(0, 30),
          scoreInTab,
          teamScores: scoreInfo
        });
      });
      
      return scores;
    });
    
    console.log('Map Scores:');
    mapScores.forEach(m => {
      console.log(`\nTab ${m.tabIndex} (ID: ${m.gameId})`);
      console.log(`  Tab text: "${m.tabText}"`);
      console.log(`  Score in tab: ${m.scoreInTab}`);
      m.teamScores.forEach(ts => {
        console.log(`  Table ${ts.table}: name="${ts.name}" score="${ts.score}" scoreAlt="${ts.scoreAlt}"`);
      });
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
