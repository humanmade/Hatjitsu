import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LobbyIdentity } from './LobbyIdentity';
import { getStoredName } from '@/lib/session';

beforeEach(() => localStorage.clear());

describe('LobbyIdentity', () => {
  it('persists an edited name to localStorage on blur', () => {
    render(<LobbyIdentity />);
    const input = screen.getByLabelText(/your name/i);
    fireEvent.change(input, { target: { value: 'Tom' } });
    fireEvent.blur(input);
    expect(getStoredName()).toBe('Tom');
  });

  it('shows a colour swatch', () => {
    render(<LobbyIdentity />);
    expect(screen.getByTestId('identity-swatch')).toBeInTheDocument();
  });
});
