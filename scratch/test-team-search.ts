import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  const query = 'Sentinels';
  const { data } = await axios.get(`https://www.vlr.gg/search/?q=${encodeURIComponent(query)}`);
  const $ = cheerio.load(data);
  
  console.log($('.wf-card').html());
}

test().catch(console.error);
