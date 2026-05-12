import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  const { data } = await axios.get('https://www.vlr.gg/matches');
  const $ = cheerio.load(data);

  const matches: any[] = [];

  $('.wf-card .match-item').each((i, el) => {
    if (i > 5) return; // limit
    const matchUrl = $(el).attr('href');
    const time = $(el).find('.match-item-time').text().trim();
    const status = $(el).find('.ml-status').text().trim();
    const team1 = $(el).find('.match-item-vs-team-name').eq(0).text().trim();
    const team2 = $(el).find('.match-item-vs-team-name').eq(1).text().trim();
    const event = $(el).find('.match-item-event').text().trim().replace(/\s+/g, ' ');

    matches.push({
      url: `https://vlr.gg${matchUrl}`,
      time,
      status,
      team1,
      team2,
      event
    });
  });

  console.log(matches);
}

test().catch(console.error);
