const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    const url = 'https://www.vlr.gg/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf';
    console.log('Loading match page...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Extract table structure
    const tableInfo = await page.evaluate(() => {
      const tables = document.querySelectorAll('.wf-table-inset.mod-overview');
      console.log('Found tables:', tables.length);
      
      const info = [];
      tables.forEach((table, idx) => {
        const headerRow = table.querySelector('thead tr');
        if (!headerRow) return;
        
        const headers = Array.from(headerRow.querySelectorAll('th')).map(th => th.textContent?.trim());
        
        const bodyRows = table.querySelectorAll('tbody tr');
        const firstRow = bodyRows[0];
        if (!firstRow) return;
        
        const cells = Array.from(firstRow.querySelectorAll('td')).map((td, i) => ({
          index: i,
          header: headers[i],
          content: td.textContent?.trim()?.substring(0, 30),
          html: td.innerHTML?.substring(0, 100)
        }));
        
        info.push({
          tableIndex: idx,
          headers: headers,
          firstRowData: cells
        });
      });
      
      return info;
    });
    
    console.log('\n=== TABLE STRUCTURE ===\n');
    tableInfo.forEach(table => {
      console.log(`Table ${table.tableIndex}:`);
      console.log('Headers:', table.headers);
      console.log('\nFirst row cells:');
      table.firstRowData.forEach(cell => {
        console.log(`  [${cell.index}] ${cell.header || 'NO HEADER'}: "${cell.content}"`);
      });
      console.log('');
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
