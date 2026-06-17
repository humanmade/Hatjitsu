import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/socket', () => ({
  socket: { connected: false, emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { Lobby } from './Lobby';
import { rememberRoom } from '@/lib/session';

beforeEach(() => localStorage.clear());

const renderLobby = () => render(<MemoryRouter><Lobby /></MemoryRouter>);

describe('Lobby', () => {
  it('shows the create button and identity strip', () => {
    renderLobby();
    expect(screen.getByRole('button', { name: /create a room/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
  });

  it('shows recent rooms once some are remembered', () => {
    rememberRoom('happy-otter');
    renderLobby();
    expect(screen.getByText('happy-otter')).toBeInTheDocument();
  });

  it('omits the recent-rooms section when none are remembered', () => {
    renderLobby();
    expect(screen.queryByRole('region', { name: /recent rooms/i })).toBeNull();
  });
});
