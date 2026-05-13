const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    const url = 'https://www.vlr.gg/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf';
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Get K/D/A structure
    const kda = await page.evaluate(() => {
      const allMapsTabs = Array.from(document.querySelectorAll('.vm-stats-gamesnav-item')).filter(el => 
        el.textContent?.includes('All Maps')
      );
      
      const allMapsGameId = allMapsTabs[0].getAttribute('data-game-id');
      const gamePanel = document.querySelector(`.vm-stats-game[data-game-id="${allMapsGameId}"]`);
      const table = gamePanel.querySelector('.wf-table-inset.mod-overview');
      const firstRow = table.querySelector('tbody tr');
      
      // Get cells 4 and 5 (K and /)
      const kCell = firstRow.querySelectorAll('td')[4];
      const slashCell = firstRow.querySelectorAll('td')[5];
      
      return {
        kCell: {
          text: kCell.textContent?.trim(),
          html: kCell.innerHTML
        },
        slashCell: {
          text: slashCell.textContent?.trim(),
          html: slashCell.innerHTML
        }
      };
    });
    
    console.log('K Cell Content:');
    console.log(kda.kCell);
    console.log('\n/ Cell Content:');
    console.log(kda.slashCell);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
