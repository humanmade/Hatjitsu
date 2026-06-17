import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Participants } from './Participants';
import type { PublicConnection } from '@hmpp/shared';

const conn = (over: Partial<PublicConnection>): PublicConnection => ({
  sessionId: 'a', name: 'Ada', color: 'red', voter: true, hasVoted: false,
  connected: true, autoDemoted: false, ...over,
});

describe('Participants', () => {
  it('marks only the facilitator with an accessibly-labelled dot', () => {
    render(
      <Participants
        connections={[conn({ sessionId: 'a', name: 'Ada' }), conn({ sessionId: 'b', name: 'Bo' })]}
        facilitatorSessionId="a"
      />,
    );
    const dots = screen.getAllByLabelText('Room Facilitator');
    expect(dots).toHaveLength(1);
    // The dot sits inside Ada's card, not Bo's.
    expect(screen.getByText('Ada').parentElement).toContainElement(dots[0]);
  });

  it('shows no facilitator dot when the seat is vacant', () => {
    render(<Participants connections={[conn({})]} facilitatorSessionId={null} />);
    expect(screen.queryByLabelText('Room Facilitator')).toBeNull();
  });
});
