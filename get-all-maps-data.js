const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    const url = 'https://www.vlr.gg/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf';
    console.log('Loading match page...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Get the "All Maps" tab data which should be cleaner
    const tableData = await page.evaluate(() => {
      // Find the "All Maps" tab
      const allMapsTabs = Array.from(document.querySelectorAll('.vm-stats-gamesnav-item')).filter(el => 
        el.textContent?.includes('All Maps')
      );
      
      if (allMapsTabs.length === 0) {
        console.log('No All Maps tab found');
        return null;
      }
      
      const allMapsGameId = allMapsTabs[0].getAttribute('data-game-id');
      console.log('All Maps game ID:', allMapsGameId);
      
      // Get the game panel with this ID
      const gamePanel = document.querySelector(`.vm-stats-game[data-game-id="${allMapsGameId}"]`);
      if (!gamePanel) {
        console.log('Game panel not found');
        return null;
      }
      
      // Get the two tables (T1 and FS)
      const tables = gamePanel.querySelectorAll('.wf-table-inset.mod-overview');
      
      const result = {
        tables: []
      };
      
      tables.forEach((table, tableIdx) => {
        const headers = Array.from(table.querySelectorAll('thead tr th')).map(th => th.textContent?.trim());
        
        const rows = [];
        table.querySelectorAll('tbody tr').forEach(tr => {
          const cells = Array.from(tr.querySelectorAll('td')).map(td => ({
            text: td.textContent?.trim().split('\n')[0], // Get first line only
            html: td.innerHTML?.substring(0, 200)
          }));
          rows.push(cells);
        });
        
        result.tables.push({
          tableIndex: tableIdx,
          headers: headers,
          rows: rows
        });
      });
      
      return result;
    });
    
    if (!tableData) {
      console.log('No data extracted');
      return;
    }
    
    console.log('\n=== ALL MAPS STATS ===\n');
    tableData.tables.forEach(table => {
      console.log(`\nTable ${table.tableIndex} (${table.tableIndex === 0 ? 'T1' : 'FULL SENSE'}):`);
      console.log('Headers:', table.headers);
      console.log('\nPlayers:');
      table.rows.forEach((row, rowIdx) => {
        if (rowIdx < 5) {  // First 5 players
          console.log(`Row ${rowIdx}:`);
          row.forEach((cell, cellIdx) => {
            console.log(`  [${cellIdx}] ${cell.text}`);
          });
          console.log('');
        }
      });
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
