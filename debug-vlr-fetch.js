const axios = require('axios');
const cheerio = require('cheerio');
(async () => {
  try {
    const { data } = await axios.get('https://www.vlr.gg/match/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36'
      }
    });
    const $ = cheerio.load(data);
    console.log('title:', $('title').text().trim());
    const navItems = $('.vm-stats-gamesnav-item');
    console.log('navItems count', navItems.length);
    navItems.each((i, el) => {
      console.log('tab', i, $(el).attr('data-game-id'), JSON.stringify($(el).text().trim()));
    });
    const games = $('.vm-stats-game');
    console.log('games count', games.length);
    games.each((i, game) => {
      console.log('game', i, $(game).attr('data-game-id'));
      const tables = $(game).find('.wf-table-inset.mod-overview');
      console.log('  tables', tables.length);
      tables.each((ti, table) => {
        const headers = $(table).find('thead tr th').map((_,th)=>$(th).text().trim()).get();
        console.log('   table', ti, 'headers', headers);
        $(table).find('tbody tr').slice(0,3).each((ri, tr) => {
          const cells = $(tr).find('td').map((_,td)=>$(td).text().trim()).get();
          console.log('    row', ri, cells);
        });
      });
    });
  } catch (err) {
    console.error('error', err);
  }
})();