const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    const url = 'https://www.vlr.gg/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf';
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Get thead HTML
    const theadHtml = await page.evaluate(() => {
      const gamePanel = document.querySelector('.vm-stats-game[data-game-id="266849"]');
      const table = gamePanel.querySelector('.wf-table-inset.mod-overview');
      const thead = table.querySelector('thead');
      return thead?.innerHTML;
    });
    
    console.log('First table THEAD HTML:');
    console.log(theadHtml?.substring(0, 2000));
    
    // Also check for score elements anywhere
    const allElements = await page.evaluate(() => {
      const gamePanel = document.querySelector('.vm-stats-game[data-game-id="266849"]');
      
      // Look for any text containing numbers that look like scores
      const allText = gamePanel.textContent;
      const scorePatterns = allText.match(/(\d+)\s*[-–]\s*(\d+)/g);
      
      return {
        textContent: allText?.substring(0, 500),
        scorePatterns: scorePatterns
      };
    });
    
    console.log('\n\nAll text in game panel:');
    console.log(allElements.textContent);
    console.log('\nScore patterns found:', allElements.scorePatterns);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
