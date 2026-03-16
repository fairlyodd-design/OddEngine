
export type HomieHostMode = 'welcome' | 'family' | 'trading' | 'studio' | 'calm';

export function inferHomieHostMode(panelId?: string): HomieHostMode {
  const id = String(panelId || '').toLowerCase();
  if (['trading', 'tradingpanel', 'marketgraphpanel', 'optionssniperterminal'].includes(id)) return 'trading';
  if (['books', 'writingpanel'].includes(id)) return 'studio';
  if (['grocerymeals', 'familybudget', 'dailychores', 'calendar'].includes(id)) return 'family';
  if (id === 'home') return 'welcome';
  return 'calm';
}

export function getHomieHostLead(mode: HomieHostMode) {
  switch (mode) {
    case 'trading':
      return 'Trading deck is live. Let’s keep it clean, sharp, and disciplined.';
    case 'studio':
      return 'Creative lane is open. I can help you keep momentum without losing the vibe.';
    case 'family':
      return 'Household lane is up. Let’s save money, keep the plan light, and make the week easier.';
    case 'welcome':
      return 'Welcome back. I’ve got the house, work, and momentum lanes ready when you are.';
    default:
      return 'I’m here with you. We can take the next easy win first.';
  }
}
