const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    const url = 'https://www.vlr.gg/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf';
    console.log('Loading match page...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Get raw HTML of first player row in All Maps
    const htmlData = await page.evaluate(() => {
      const allMapsTabs = Array.from(document.querySelectorAll('.vm-stats-gamesnav-item')).filter(el => 
        el.textContent?.includes('All Maps')
      );
      
      const allMapsGameId = allMapsTabs[0].getAttribute('data-game-id');
      const gamePanel = document.querySelector(`.vm-stats-game[data-game-id="${allMapsGameId}"]`);
      const tables = gamePanel.querySelectorAll('.wf-table-inset.mod-overview');
      
      const result = [];
      tables.forEach((table, tableIdx) => {
        const firstRow = table.querySelector('tbody tr');
        if (!firstRow) return;
        
        const cells = firstRow.querySelectorAll('td');
        cells.forEach((td, idx) => {
          if (idx <= 6) {  // Look at first 7 cells
            result.push({
              index: idx,
              innerHTML: td.innerHTML,
              textContent: td.textContent?.trim()
            });
          }
        });
      });
      
      return result;
    });
    
    console.log('=== RAW HTML INSPECTION ===\n');
    htmlData.forEach(cell => {
      console.log(`Cell ${cell.index}:`);
      console.log('Text:', cell.textContent);
      console.log('HTML:', cell.innerHTML.substring(0, 300));
      console.log('');
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
