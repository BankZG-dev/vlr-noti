import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  const { data } = await axios.get('https://www.vlr.gg/645503/sentinels-vs-nrg-vct-2026-americas-stage-1-w5');
  const $ = cheerio.load(data);

  // Match info
  const team1 = $('.match-header-vs .match-header-link-name').eq(0).text().trim();
  const team2 = $('.match-header-vs .match-header-link-name').eq(1).text().trim();
  const score1 = $('.match-header-vs-score .js-spoiler span').eq(0).text().trim();
  const score2 = $('.match-header-vs-score .js-spoiler span').eq(2).text().trim(); // span at 1 is colon usually

  const status = $('.match-header-vs-note').eq(1).text().trim();

  console.log(`Match: ${team1} [${score1} - ${score2}] ${team2} - ${status}`);

  // Map scores
  $('.vm-stats-gamesnav-item').each((i, el) => {
    const mapName = $(el).find('div').contents().first().text().trim().replace(/\s+/g, '');
    const mapScore = $(el).find('div').contents().last().text().trim(); // Sometimes has score if map played
    if (mapName && mapName !== 'AllMaps') {
      console.log(`Map: ${mapName} - ${mapScore}`);
    }
  });

}

test().catch(console.error);
