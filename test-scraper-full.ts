import { getMatchDetails } from './src/scraper/vlr';

async function test() {
  console.log('Fetching match details...\n');
  const details = await getMatchDetails('https://www.vlr.gg/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf');
  
  if (!details) {
    console.log('Failed to fetch match details');
    process.exit(1);
  }
  
  console.log('='.repeat(80));
  console.log(`MATCH: ${details.team1} vs ${details.team2}`);
  console.log(`Series Score: ${details.score1} - ${details.score2}`);
  console.log(`Status: ${details.status}`);
  console.log(`Event: ${details.event}`);
  console.log('='.repeat(80));
  
  // Show map results
  console.log('\nMAP RESULTS:\n');
  details.maps.forEach((map, i) => {
    console.log(`Map ${i+1}: ${map.name} (${map.score})`);
    console.log(`  ${details.team1} Players:`);
    map.team1Stats.slice(0, 3).forEach(p => {
      console.log(`    ${p.name.padEnd(12)} R=${p.rating.padEnd(5)} ACS=${p.acs.padEnd(5)} K/D/A=${p.kda.padEnd(8)} HS%=${p.hsPercent} FK=${p.fk} FD=${p.fd}`);
    });
    console.log(`  ${details.team2} Players:`);
    map.team2Stats.slice(0, 3).forEach(p => {
      console.log(`    ${p.name.padEnd(12)} R=${p.rating.padEnd(5)} ACS=${p.acs.padEnd(5)} K/D/A=${p.kda.padEnd(8)} HS%=${p.hsPercent} FK=${p.fk} FD=${p.fd}`);
    });
    console.log('');
  });
  
  // Show overall stats
  if (details.allMapsStats) {
    console.log('OVERALL STATS (ALL MAPS):\n');
    console.log(`${details.team1} Players:`);
    details.allMapsStats.team1Stats.forEach(p => {
      console.log(`  ${p.name.padEnd(12)} R=${p.rating.padEnd(5)} ACS=${p.acs.padEnd(5)} K/D/A=${p.kda.padEnd(8)} ADR=${p.adr.padEnd(5)} HS%=${p.hsPercent.padEnd(5)} FK=${p.fk} FD=${p.fd} +/-=${p.plusMinus}`);
    });
    console.log(`\n${details.team2} Players:`);
    details.allMapsStats.team2Stats.forEach(p => {
      console.log(`  ${p.name.padEnd(12)} R=${p.rating.padEnd(5)} ACS=${p.acs.padEnd(5)} K/D/A=${p.kda.padEnd(8)} ADR=${p.adr.padEnd(5)} HS%=${p.hsPercent.padEnd(5)} FK=${p.fk} FD=${p.fd} +/-=${p.plusMinus}`);
    });
  }
  
  process.exit(0);
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
