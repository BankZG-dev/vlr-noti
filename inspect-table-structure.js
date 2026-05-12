const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const url = 'https://www.vlr.gg/645503/sentinels-vs-nrg-vct-2026-americas-stage-1-w5';
  
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const html = await page.content();
  
  // Save full HTML
  fs.writeFileSync('vlr-page-full.html', html);
  console.log('Full HTML saved');
  
  // Get the table structure
  const tableInfo = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    console.log('Total tables:', tables.length);
    
    // Get first table with data
    const firstTable = tables[0];
    if (!firstTable) return null;
    
    const rows = firstTable.querySelectorAll('tbody tr');
    console.log('Rows in first table:', rows.length);
    
    if (rows.length > 0) {
      const firstRow = rows[0];
      const cells = firstRow.querySelectorAll('td');
      console.log('Cells in first row:', cells.length);
      
      // Log first few cells with their HTML
      let cellData = [];
      for (let i = 0; i < Math.min(5, cells.length); i++) {
        cellData.push({
          index: i,
          text: cells[i].textContent.slice(0, 50),
          html: cells[i].innerHTML.slice(0, 100)
        });
      }
      return cellData;
    }
    return null;
  });
  
  console.log('Table structure:', JSON.stringify(tableInfo, null, 2));
  
  await browser.close();
})().catch(err => console.error('Error:', err.message));