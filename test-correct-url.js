const { chromium } = require('playwright');
const cheerio = require('cheerio');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Use correct VLR URL format
  const url = 'https://www.vlr.gg/645503/sentinels-vs-nrg-vct-2026-americas-stage-1-w5';
  console.log('Fetching:', url);
  
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  // Test selectors from test-match.ts
  const team1 = $('.match-header-vs .match-header-link-name').eq(0).text().trim();
  const team2 = $('.match-header-vs .match-header-link-name').eq(1).text().trim();
  
  console.log('Team 1:', team1);
  console.log('Team 2:', team2);
  
  const mapItems = $('.vm-stats-gamesnav-item').length;
  console.log('Map items found:', mapItems);
  
  const statRows = $('table tbody tr').length;
  console.log('Stat rows found:', statRows);
  
  // Try to find first stat row
  const firstRow = $('table tbody tr').eq(0);
  if (firstRow.length) {
    const cells = firstRow.find('td');
    console.log('First row cells:', cells.length);
    cells.each((i, cell) => {
      console.log(`  Cell ${i}: ${$(cell).text().trim().slice(0, 30)}`);
    });
  }
  
  await browser.close();
})().catch(err => console.error('Error:', err.message));