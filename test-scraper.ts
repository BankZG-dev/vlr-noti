import { getMatchDetails } from './src/scraper/vlr';

async function test() {
  console.log('Fetching match details...');
  const details = await getMatchDetails('https://www.vlr.gg/match/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf');
  if (details) {
    console.log('Team 1:', details.team1);
    console.log('Team 2:', details.team2);
    console.log('Series Score:', details.score1, '-', details.score2);
    console.log('Maps:', details.maps.length);
    details.maps.forEach((map, i) => {
      console.log(`\nMap ${i+1}: ${map.name} (${map.score})`);
      console.log('T1 Players:');
      map.team1Stats.slice(0, 2).forEach(p => {
        console.log(`  ${p.name}: R=${p.rating} ACS=${p.acs} K/D/A=${p.kda}`);
      });
    });
    if (details.allMapsStats) {
      console.log('\nAll Maps T1:');
      details.allMapsStats.team1Stats.slice(0, 2).forEach(p => {
        console.log(`  ${p.name}: R=${p.rating} ACS=${p.acs} K/D/A=${p.kda}`);
      });
    }
  } else {
    console.log('Failed to fetch match details');
  }
  process.exit(0);
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});