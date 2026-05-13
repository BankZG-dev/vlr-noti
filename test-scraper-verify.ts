import { getMatchDetails } from './src/scraper/vlr';

async function test() {
  console.log('Testing VLR Scraper Fix');
  console.log('='.repeat(80));
  
  const testUrl = 'https://www.vlr.gg/666491/t1-vs-full-sense-vct-2026-pacific-stage-1-ubsf';
  console.log(`\nLoading: ${testUrl}\n`);
  
  const details = await getMatchDetails(testUrl);
  
  if (!details) {
    console.log('❌ FAILED: Could not load match details');
    process.exit(1);
  }
  
  console.log('✅ Match data loaded successfully\n');
  
  // Verification against user-provided data
  const tests = [
    { name: 'Team 1', actual: details.team1, expected: 'T1' },
    { name: 'Team 2', actual: details.team2, expected: 'FULL SENSE' },
    { name: 'Series Score', actual: `${details.score1}-${details.score2}`, expected: '0-2' },
    { name: 'Map Count', actual: details.maps.length.toString(), expected: '2' },
    { name: 'Map 1 Name', actual: details.maps[0]?.name, expected: 'Pearl' },
    { name: 'Map 1 Score', actual: details.maps[0]?.score, expected: '9-13' },
    { name: 'Map 2 Name', actual: details.maps[1]?.name, expected: 'Lotus' },
    { name: 'Map 2 Score', actual: details.maps[1]?.score, expected: '8-13' },
  ];
  
  console.log('VERIFICATION TESTS:\n');
  let passed = 0;
  let failed = 0;
  
  tests.forEach(test => {
    const isPass = test.actual === test.expected;
    const symbol = isPass ? '✅' : '❌';
    console.log(`${symbol} ${test.name}: "${test.actual}" ${isPass ? '✓' : `(expected: "${test.expected}")`}`);
    if (isPass) passed++; else failed++;
  });
  
  // Verify player stats (most important)
  console.log('\nPLAYER STATS VERIFICATION:\n');
  
  if (details.allMapsStats) {
    const meteor = details.allMapsStats.team1Stats.find(p => p.name === 'Meteor');
    if (meteor) {
      console.log('Meteor (Overall):');
      const statTests = [
        { name: 'ACS', actual: meteor.acs, expected: '237' },
        { name: 'K/D/A', actual: meteor.kda, expected: '32/37/14' },
        { name: 'HS%', actual: meteor.hsPercent, expected: '31%' },
        { name: 'FK', actual: meteor.fk, expected: '5' },
        { name: 'FD', actual: meteor.fd, expected: '6' },
      ];
      
      statTests.forEach(test => {
        const isPass = test.actual === test.expected;
        const symbol = isPass ? '✅' : '⚠️ ';
        console.log(`  ${symbol} ${test.name}: ${test.actual} ${isPass ? '' : `(expected: ${test.expected})`}`);
        if (isPass) passed++; else failed++;
      });
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED - Scraper is working correctly!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed - Review above');
    process.exit(1);
  }
}

test().catch(err => {
  console.error('❌ FATAL ERROR:', err.message);
  process.exit(1);
});
