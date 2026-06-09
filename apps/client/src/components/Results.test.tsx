import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Results } from './Results';
import type { PublicRoom } from '@hmpp/shared';

const room = (over: Partial<PublicRoom>): PublicRoom => ({
  slug: 'r', mode: 'live', adminSessionId: 'a', cardPack: '135 set', forcedReveal: false,
  revealed: true, roundLabel: '', history: [],
  connections: [
    { sessionId: 'a', name: 'A', color: 'red', voter: true, hasVoted: true, vote: '5' },
    { sessionId: 'b', name: 'B', color: 'blue', voter: true, hasVoted: true, vote: '5' },
  ],
  ...over,
});

describe('Results', () => {
  it('shows the average when revealed', () => {
    render(<Results room={room({})} />);
    expect(screen.getByText(/Average/i)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
  it('renders nothing useful before reveal', () => {
    const { container } = render(<Results room={room({ revealed: false })} />);
    expect(container.textContent).not.toMatch(/Average/i);
  });
});
