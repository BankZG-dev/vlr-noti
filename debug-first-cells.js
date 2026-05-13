const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    const url = 'https://www.vlr.gg/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf';
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Get R and ACS cells  
    const stats = await page.evaluate(() => {
      const allMapsTabs = Array.from(document.querySelectorAll('.vm-stats-gamesnav-item')).filter(el => 
        el.textContent?.includes('All Maps')
      );
      
      const allMapsGameId = allMapsTabs[0].getAttribute('data-game-id');
      const gamePanel = document.querySelector(`.vm-stats-game[data-game-id="${allMapsGameId}"]`);
      const table = gamePanel.querySelector('.wf-table-inset.mod-overview');
      const firstRow = table.querySelector('tbody tr');
      
      // Check cells 0-6
      const result = [];
      const cells = firstRow.querySelectorAll('td');
      for (let i = 0; i < 7; i++) {
        const cell = cells[i];
        result.push({
          index: i,
          textContent: cell.textContent?.trim()?.substring(0, 50),
          innerHTML: cell.innerHTML?.substring(0, 150)
        });
      }
      
      return result;
    });
    
    console.log('First row cells:');
    stats.forEach(cell => {
      console.log(`[${cell.index}] Text: "${cell.textContent}"`);
      console.log(`    HTML: ${cell.innerHTML}`);
      console.log('');
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
