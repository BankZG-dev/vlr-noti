const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    const url = 'https://www.vlr.gg/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf';
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Look for score display elements
    const scores = await page.evaluate(() => {
      const results = [];
      
      const gamePanels = document.querySelectorAll('.vm-stats-game');
      gamePanels.forEach((panel, idx) => {
        const gameId = panel.getAttribute('data-game-id');
        if (gameId === 'all') return;
        
        // Look for elements with specific numeric content
        const allDivs = panel.querySelectorAll('div, span, td');
        const scoreElements = [];
        
        allDivs.forEach((el) => {
          const text = el.textContent?.trim();
          // Look for single digit or double digit numbers that look like scores
          if (text && /^\d{1,2}$/.test(text)) {
            const classList = el.className;
            const computed = window.getComputedStyle(el);
            scoreElements.push({
              text,
              class: classList?.substring(0, 100),
              tag: el.tagName,
              width: computed.width,
              height: computed.height,
              fontSize: computed.fontSize
            });
          }
        });
        
        results.push({
          gameId,
          topScores: scoreElements.slice(0, 4)
        });
      });
      
      return results;
    });
    
    console.log('Score Elements:');
    scores.forEach(r => {
      console.log(`\nGame ${r.gameId}:`);
      r.topScores.forEach((el, i) => {
        console.log(`  [${i}] "${el.text}" - ${el.tag}.${el.class} (${el.width} x ${el.height}, font: ${el.fontSize})`);
      });
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
