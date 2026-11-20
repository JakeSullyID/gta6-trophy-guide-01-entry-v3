// Helper module for automated screenshot state configuration

async function applyShotState() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');

  if (!shot) {
    window.__shotApplied = true;
    return;
  }

  // Wait for window.__shotReady (poll every 100ms, up to 5 seconds)
  let waited = 0;
  while (!window.__shotReady && waited < 5000) {
    await new Promise(r => setTimeout(r, 100));
    waited += 100;
  }

  const guide = window.__trophyGuide;
  if (!guide) {
    window.__shotApplied = true;
    return;
  }

  if (shot === 'cover') {
    const earlyEarned = [
      'Just Like Paradise',
      'Paradise Lost',
      'Trust',
      'Baited My Tackle',
      'Stick Fiddler',
      'Whip It Good',
      'Treat Yo Self',
      'Master of None',
      'Top Fun',
      'Earn Cash, Not Kudos',
      'Not Kudos',
      'Personal Best',
      'The Goodtime State'
    ];
    guide.state.earned = earlyEarned;
    guide.state.counts = {
      'Cunning Stunts': 120,
      'Whip It Good': 64,
      'You WAiNKer!': 37
    };
    guide.state.spoiler = false;
    localStorage.setItem('leonida-trophy-guide-v1', JSON.stringify(guide.state));
    guide.selectTrophy('Positive Mental Attitude');
    guide.renderAll();
  } else if (shot === 'roadmap') {
    guide.switchTab('roadmap');
  } else if (shot === 'missables') {
    guide.switchTab('missables');
  } else if (shot === 'spoiler') {
    guide.state.earned = [];
    guide.state.counts = {};
    guide.state.spoiler = true;
    localStorage.setItem('leonida-trophy-guide-v1', JSON.stringify(guide.state));
    guide.switchTab('checklist');
    guide.renderAll();
  }

  window.__shotApplied = true;
}

applyShotState();
