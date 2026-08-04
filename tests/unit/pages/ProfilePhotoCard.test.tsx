import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import ProfilePhotoCard from '../../../src/pages/Shared/ProfilePhotoCard';

function selectFile(input: HTMLElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockRemove = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...args: any[]) => mockUpload(...args),
        getPublicUrl: (...args: any[]) => mockGetPublicUrl(...args),
        remove: (...args: any[]) => mockRemove(...args),
      }),
    },
    from: () => ({
      update: (data: any) => {
        mockUpdate(data);
        return { eq: (...args: any[]) => mockEq(...args) };
      },
    }),
  },
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mockUpload.mockResolvedValue({ error: null });
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/avatars/user-1/avatar' } });
  mockEq.mockResolvedValue({ error: null });
  mockRemove.mockResolvedValue({ error: null });
});

const baseProps = {
  userId: 'user-1',
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  onAvatarChange: vi.fn(),
};

describe('ProfilePhotoCard', () => {
  it('shows initials when avatarUrl is null', () => {
    render(<ProfilePhotoCard {...baseProps} avatarUrl={null} />);
    expect(screen.getByText('JD')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows an <img> when avatarUrl is set', () => {
    render(<ProfilePhotoCard {...baseProps} avatarUrl="https://cdn.example.com/avatars/user-1/avatar" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.queryByText('JD')).not.toBeInTheDocument();
  });

  it('only shows the Remove button when there is a photo', () => {
    const { rerender } = render(<ProfilePhotoCard {...baseProps} avatarUrl={null} />);
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();

    rerender(<ProfilePhotoCard {...baseProps} avatarUrl="https://cdn.example.com/avatars/user-1/avatar" />);
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('shows a visible error and does not call onAvatarChange for an oversized file', async () => {
    const onAvatarChange = vi.fn();
    render(<ProfilePhotoCard {...baseProps} avatarUrl={null} onAvatarChange={onAvatarChange} />);
    const input = screen.getByLabelText('Choose a profile photo');
    const bigFile = new File([new ArrayBuffer(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });

    selectFile(input, bigFile);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('2 MB');
    });
    expect(onAvatarChange).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('shows a visible error for a non-image file', async () => {
    const onAvatarChange = vi.fn();
    render(<ProfilePhotoCard {...baseProps} avatarUrl={null} onAvatarChange={onAvatarChange} />);
    const input = screen.getByLabelText('Choose a profile photo');
    const badFile = new File(['hello'], 'file.txt', { type: 'text/plain' });

    selectFile(input, badFile);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('image file');
    });
    expect(onAvatarChange).not.toHaveBeenCalled();
  });

  it('calls onAvatarChange with the new URL on a successful upload', async () => {
    const onAvatarChange = vi.fn();
    render(<ProfilePhotoCard {...baseProps} avatarUrl={null} onAvatarChange={onAvatarChange} />);
    const input = screen.getByLabelText('Choose a profile photo');
    const goodFile = new File(['hello'], 'avatar.png', { type: 'image/png' });

    selectFile(input, goodFile);

    await waitFor(() => {
      expect(onAvatarChange).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/cdn\.example\.com\/avatars\/user-1\/avatar\?t=\d+$/),
      );
    });
  });
});
