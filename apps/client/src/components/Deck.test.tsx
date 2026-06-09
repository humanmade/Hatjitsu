import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Deck } from './Deck';

describe('Deck', () => {
  it('renders the cards of a named pack and reports a pick', () => {
    const onPick = vi.fn();
    render(<Deck cardPack="135 set" myVote={null} onPick={onPick} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect(onPick).toHaveBeenCalledWith('8');
  });
});
