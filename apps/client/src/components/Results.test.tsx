import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Results } from './Results';
import type { PublicRoom } from '@hmpp/shared';

const room = (over: Partial<PublicRoom>): PublicRoom => ({
  slug: 'r', mode: 'live', facilitatorSessionId: 'a', roundStartedAt: 0, cardPack: '135 set',
  revealed: true, roundLabel: '', history: [], ejectOnLeave: true,
  votes: ['5', '5'],
  connections: [
    { sessionId: 'a', name: 'A', color: 'red', voter: true, hasVoted: true, connected: true, autoDemoted: false },
    { sessionId: 'b', name: 'B', color: 'blue', voter: true, hasVoted: true, connected: true, autoDemoted: false },
  ],
  ...over,
});

describe('Results', () => {
  it('shows numeric stats when revealed', () => {
    render(<Results room={room({})} />);
    expect(screen.getByText(/Average/i)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // average
    expect(screen.getByText('10')).toBeInTheDocument(); // total
  });
  it('renders nothing before reveal', () => {
    const { container } = render(<Results room={room({ revealed: false, votes: [] })} />);
    expect(container.textContent).not.toMatch(/Average/i);
  });
});
