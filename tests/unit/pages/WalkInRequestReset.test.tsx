// Client instruction, 2026-08-16: once a walk-in request has been submitted the
// form must come back EMPTY.
//
// On /guard/walk-in (RegisterWalkIn) the form is the page and never unmounts, so
// every field kept the previous visitor's details — the next person at the gate
// was registered on top of a pre-filled name, phone, vendor and remarks, and the
// mandatory ID scan and photo still read as satisfied. The reset therefore lives
// inside WalkInRequest, not in a caller: GuardWalkIns happens to unmount the form
// and would have hidden the defect on one of the two surfaces.
//
// A FAILED submit is the mirror rule and is tested here too — clearing the form
// when the insert failed would throw away everything the guard typed while the
// visitor is still standing there.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import WalkInRequest from '../../../src/pages/Guard/WalkInRequest';

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockUseCameraStream = vi.hoisted(() => vi.fn());
const mockGetEngine = vi.hoisted(() => vi.fn());
const mockRecognise = vi.hoisted(() => vi.fn());
const visitsInsert = vi.hoisted(() => vi.fn());
const mockUploadPhoto = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    channel: vi.fn(() => ({ on: () => ({ subscribe: vi.fn() }) })),
    removeChannel: vi.fn(),
  },
}));
vi.mock('../../../src/lib/useCameraStream', () => ({ useCameraStream: mockUseCameraStream }));
vi.mock('../../../src/lib/ai/engine', () => ({ getEngine: mockGetEngine }));
// Re-armed in beforeEach, not once at mock time: this file's afterEach calls
// vi.restoreAllMocks(), which strips the implementation off a module mock, so a
// one-shot mockResolvedValue here would resolve to undefined from the second
// test onwards and every submit after the first would fail inside uploadPhoto.
vi.mock('../../../src/lib/photoUpload', () => ({ uploadPhoto: mockUploadPhoto }));

const mockDepts = [{ id: 'dept-it', name: 'Information Technology', code: 'IT', created_at: '2026-01-01' }];
const mockHosts = [{ id: 'h1', full_name: 'Priya Sharma', email: 'hod.it@demo.vms', role: 'hod' }];

const PAN_TEXT = [
  'INCOME TAX DEPARTMENT',
  'PERMANENT ACCOUNT NUMBER',
  'ABCDE1234F',
  'Name: Rahul Verma',
].join('\n');

beforeEach(() => {
  mockUseCameraStream.mockReturnValue({ status: 'streaming', errorMessage: '', start: vi.fn(), stop: vi.fn() });
  mockGetEngine.mockReturnValue({
    id: 'browser-wasm',
    ocr: vi.fn().mockResolvedValue({ recognise: mockRecognise }),
    face: vi.fn(),
  });
  mockRecognise.mockResolvedValue({ lines: [{ text: PAN_TEXT, confidence: 0.9 }], fullText: PAN_TEXT });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: 1280 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: 720 });
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['frame'], { type: 'image/jpeg' }));
  };
  HTMLCanvasElement.prototype.getContext = function () {
    return { drawImage: vi.fn() } as any;
  };
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
  mockUploadPhoto.mockResolvedValue({ photoPath: 'visits/1.webp', photoData: 'data:image/webp;base64,x' });
  visitsInsert.mockResolvedValue({ error: null });
  mockRpc.mockImplementation((name: string) => {
    if (name === 'get_hosts_for_department') return Promise.resolve({ data: mockHosts, error: null });
    if (name === 'get_active_visit_for_phone') return Promise.resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'departments') {
      return { select: () => ({ order: vi.fn().mockResolvedValue({ data: mockDepts, error: null }) }) };
    }
    if (table === 'visitors') {
      return {
        select: () => ({
          eq: Object.assign(vi.fn().mockResolvedValue({ data: [], error: null }), {}),
        }),
        upsert: () => ({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'vis-1', full_name: 'Rahul Verma' }, error: null }) }) }),
      };
    }
    if (table === 'visits') return { insert: visitsInsert };
    return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Fill every field, scan an ID and take a photo, then press submit. */
async function fillAndSubmit() {
  const boxes = await screen.findAllByRole('textbox');
  fireEvent.change(screen.getByPlaceholderText(/98xxx/), { target: { value: '9876543210' } });
  fireEvent.change(boxes[1], { target: { value: 'Rahul Verma' } });
  fireEvent.change(boxes[2], { target: { value: 'Acme Supplies' } });
  fireEvent.change(screen.getByLabelText(/Remarks/i), { target: { value: 'Van waiting at gate 2' } });

  const deptSelect = screen.getByText('Department *').parentElement!.querySelector('select')!;
  fireEvent.change(deptSelect, { target: { value: 'dept-it' } });
  await screen.findByText('Priya Sharma');
  const hostSelect = screen.getByText('Person to Meet *').parentElement!.querySelector('select')!;
  fireEvent.change(hostSelect, { target: { value: 'h1' } });

  fireEvent.click(screen.getByText('Scan ID card'));
  fireEvent.click(await screen.findByText('Capture Card'));
  fireEvent.click(await screen.findByText('Use Details'));
  fireEvent.click(await screen.findByText('Turn on camera'));
  fireEvent.click(await screen.findByText('Capture Photo'));
  fireEvent.click(await screen.findByText('Use Photo'));

  fireEvent.click(screen.getByRole('button', { name: /send approval request/i }));
}

describe('WalkInRequest resets after a submitted request', () => {
  it('clears every field once the request has been raised', async () => {
    const onSubmitted = vi.fn();
    render(<WalkInRequest onSubmitted={onSubmitted} />);
    await fillAndSubmit();

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith('Rahul Verma'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/98xxx/)).toHaveValue('');
    });
    const boxes = screen.getAllByRole('textbox');
    expect(boxes[1]).toHaveValue('');
    expect(boxes[2]).toHaveValue('');
    expect(screen.getByLabelText(/Remarks/i)).toHaveValue('');

    const deptSelect = screen.getByText('Department *').parentElement!.querySelector('select')!;
    expect(deptSelect).toHaveValue('');
    const hostSelect = screen.getByText('Person to Meet *').parentElement!.querySelector('select')!;
    expect(hostSelect).toHaveValue('');
  });

  it('drops the ID scan and the photo, so the next request must capture its own', async () => {
    render(<WalkInRequest onSubmitted={vi.fn()} />);
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send approval request/i })).toBeDisabled();
    });
    // The scan summary is gone and the scan button is back.
    expect(screen.queryByText('ID scanned')).not.toBeInTheDocument();
    expect(screen.getByText('Scan ID card')).toBeInTheDocument();
    // The previous visitor's face is no longer held for review, AND the camera
    // is off: PhotoCapture is unmounted, so the webcam is not left streaming at
    // an empty form pointed at whoever is next in the queue (client report,
    // 2026-08-16).
    expect(screen.queryByText('Use Photo')).not.toBeInTheDocument();
    expect(screen.queryByText('Capture Photo')).not.toBeInTheDocument();
    expect(document.querySelector('video')).toBeNull();
    expect(screen.getByText('Turn on camera')).toBeInTheDocument();
  });

  it('keeps everything the guard typed when the request FAILS', async () => {
    visitsInsert.mockResolvedValue({ error: { message: 'insert failed' } });
    const onSubmitted = vi.fn();
    render(<WalkInRequest onSubmitted={onSubmitted} />);
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/98xxx/)).toHaveValue('9876543210');
    });
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Remarks/i)).toHaveValue('Van waiting at gate 2');
    expect(screen.getByText('ID scanned')).toBeInTheDocument();
  });
});
