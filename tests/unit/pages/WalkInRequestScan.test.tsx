import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import WalkInRequest from '../../../src/pages/Guard/WalkInRequest';

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockUseCameraStream = vi.hoisted(() => vi.fn());
const mockGetEngine = vi.hoisted(() => vi.fn());
const mockRecognise = vi.hoisted(() => vi.fn());
const visitorsUpsert = vi.hoisted(() => vi.fn());

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
// A registration now uploads the visitor's photo before it inserts the visit
// (client instruction, 2026-08-16). Storage is not part of this file's subject.
vi.mock('../../../src/lib/photoUpload', () => ({
  uploadPhoto: vi.fn().mockResolvedValue({ photoPath: 'visits/1.webp', photoData: 'data:image/webp;base64,x' }),
}));

const mockDepts = [
  { id: 'dept-it', name: 'Information Technology', code: 'IT', created_at: '2026-01-01' },
];
const mockHosts = [
  { id: 'h1', full_name: 'Priya Sharma', email: 'hod.it@demo.vms', role: 'hod' },
];

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
        select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        upsert: visitorsUpsert.mockReturnValue({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'vis-1', full_name: 'Rahul Verma' }, error: null }) }) }),
      };
    }
    return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('M-AI-OCR-UI: WalkInRequest scan wiring', () => {
  it('shows the Scan ID card button', async () => {
    render(<WalkInRequest onSubmitted={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Scan ID card')).toBeInTheDocument();
    });
  });

  // Same rule as the QR flag: scanning is UNCONDITIONAL (the flag was removed
  // 2026-08-13 — Vite inlines env at build time, so an off-state would ship a
  // permanently dead button). The env var must have no effect whatsoever.
  it('shows the Scan ID card button even when VITE_FEATURE_OCR is "false"', async () => {
    vi.stubEnv('VITE_FEATURE_OCR', 'false');
    render(<WalkInRequest onSubmitted={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Scan ID card')).toBeInTheDocument();
    });
  });

  it('opens the overlay, scans, and prefills name, ID type and last 4', async () => {
    render(<WalkInRequest onSubmitted={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(await screen.findByText('Scan ID card'));
    await waitFor(() => {
      expect(screen.getByText('Capture Card')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Capture Card'));
    await waitFor(() => {
      expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Use Details'));
    await waitFor(() => {
      expect(screen.getByDisplayValue('Rahul Verma')).toBeInTheDocument();
    });
  });

  it('scan result does not overwrite a name the guard already typed', async () => {
    render(<WalkInRequest onSubmitted={vi.fn()} onCancel={vi.fn()} />);
    const nameInput = (await screen.findAllByRole('textbox'))[1];
    fireEvent.change(nameInput, { target: { value: 'Manually Typed Name' } });
    fireEvent.click(screen.getByText('Scan ID card'));
    fireEvent.click(screen.getByText('Capture Card'));
    await waitFor(() => {
      expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Use Details'));
    await waitFor(() => {
      expect(screen.getByDisplayValue('Manually Typed Name')).toBeInTheDocument();
    });
  });

  it('submits id_type and id_last4 with the visitor upsert', async () => {
    render(<WalkInRequest onSubmitted={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(await screen.findByText('Scan ID card'));
    fireEvent.click(await screen.findByText('Capture Card'));
    fireEvent.click(await screen.findByText('Use Details'));

    const phoneInput = screen.getByPlaceholderText(/98xxx/);
    fireEvent.change(phoneInput, { target: { value: '9876543210' } });
    const deptSelect = screen.getByText('Department *').parentElement!.querySelector('select')!;
    fireEvent.change(deptSelect, { target: { value: 'dept-it' } });
    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });
    const hostSelect = screen.getByText('Person to Meet *').parentElement!.querySelector('select')!;
    fireEvent.change(hostSelect, { target: { value: 'h1' } });

    // The photo is mandatory too, and PhotoCapture only hands the blob up on
    // "Use Photo" — the scan alone no longer gets past the submit button.
    // The camera is armed by hand on this form (client report, 2026-08-16) —
    // PhotoCapture only mounts once the guard asks for it, so it cannot be left
    // streaming at a cleared form.
    fireEvent.click(await screen.findByText('Turn on camera'));
    fireEvent.click(await screen.findByText('Capture Photo'));
    fireEvent.click(await screen.findByText('Use Photo'));

    fireEvent.click(screen.getByRole('button', { name: /send approval request/i }));

    await waitFor(() => {
      const upsertCall = visitorsUpsert.mock.calls.find((c: any[]) => c[0]?.id_type);
      expect(upsertCall).toBeTruthy();
      expect(upsertCall[0].id_type).toBe('PAN');
      expect(upsertCall[0].id_last4).toBe('234F');
    });
  });

  // Client instruction, 2026-08-16. The HOD approving a walk-in has never met
  // this person; the request must carry a scanned document and a face before it
  // can be handed to them.
  it('keeps the submit disabled until both the ID and the photo are captured', async () => {
    render(<WalkInRequest onSubmitted={vi.fn()} onCancel={vi.fn()} />);
    const submit = await screen.findByRole('button', { name: /send approval request/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByText('Scan ID card'));
    fireEvent.click(await screen.findByText('Capture Card'));
    fireEvent.click(await screen.findByText('Use Details'));
    expect(submit).toBeDisabled();

    // The camera is armed by hand on this form (client report, 2026-08-16) —
    // PhotoCapture only mounts once the guard asks for it, so it cannot be left
    // streaming at a cleared form.
    fireEvent.click(await screen.findByText('Turn on camera'));
    fireEvent.click(await screen.findByText('Capture Photo'));
    fireEvent.click(await screen.findByText('Use Photo'));
    await waitFor(() => expect(submit).not.toBeDisabled());
  });

  it('closes the overlay without applying anything', async () => {
    render(<WalkInRequest onSubmitted={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(await screen.findByText('Scan ID card'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByText('Capture Card')).not.toBeInTheDocument();
    });
  });
});

// THE SCANNED NAME IS CHECKED AGAINST THE TYPED ONE, AND THE GUARD MAY OVERRIDE
// IT (client instruction, 2026-08-17). The register never compared the two: the
// scan seeded the name field when it was empty and was otherwise never read
// again, so a guard who typed what the visitor SAID and then scanned somebody
// else's card sent the approver a request whose name and document disagreed,
// with nothing on screen saying so. The override carries NO reason box — a
// mandatory sentence at a gate is a queue.
describe('WalkInRequest: scanned name vs typed name', () => {
  const MISMATCH = ['INCOME TAX DEPARTMENT', 'PERMANENT ACCOUNT NUMBER', 'ABCDE1234F', 'Name: Suresh Patel'].join('\n');

  async function typeThenScan(typed: string) {
    render(<WalkInRequest onSubmitted={vi.fn()} onCancel={vi.fn()} />);
    const nameInput = (await screen.findAllByRole('textbox'))[1];
    fireEvent.change(nameInput, { target: { value: typed } });
    fireEvent.click(screen.getByText('Scan ID card'));
    fireEvent.click(await screen.findByText('Capture Card'));
    fireEvent.click(await screen.findByText('Use Details'));
  }

  it('says so when the ID names somebody else, printing both names', async () => {
    mockRecognise.mockResolvedValue({ lines: [{ text: MISMATCH, confidence: 0.9 }], fullText: MISMATCH });
    await typeThenScan('Rahul Verma');

    expect(await screen.findByText(/the id names somebody else/i)).toBeInTheDocument();
    // The difference between them IS the finding, so both are printed.
    expect(screen.getByText('Suresh Patel')).toBeInTheDocument();
    expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
  });

  it('blocks the request until the guard overrides, then releases it in one press', async () => {
    mockRecognise.mockResolvedValue({ lines: [{ text: MISMATCH, confidence: 0.9 }], fullText: MISMATCH });
    await typeThenScan('Rahul Verma');
    await screen.findByText(/the id names somebody else/i);

    // The photo is the OTHER requirement on this form and is unrelated to the
    // names; it is satisfied here so the mismatch is the only thing left
    // holding the button down, which is what this test is about.
    fireEvent.click(screen.getByRole('button', { name: /turn on camera/i }));
    fireEvent.click(await screen.findByText('Capture Photo'));
    fireEvent.click(await screen.findByText('Use Photo'));

    const submit = screen.getByRole('button', { name: /send approval request/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /send anyway/i }));
    expect(screen.getByText(/overridden by you/i)).toBeInTheDocument();
    expect(submit).not.toBeDisabled();
    // No reason is collected, on client instruction — the override is one press.
    expect(screen.queryByLabelText(/reason/i)).toBeNull();
  });

  // A missing name on either side is NOT a mismatch. `namesMatch` returns false
  // for a null, and treating "the OCR read no name" as "the wrong person" would
  // fire this warning on half the cards the parser sees.
  it('says nothing when the scan read no name at all', async () => {
    const NO_NAME = ['INCOME TAX DEPARTMENT', 'PERMANENT ACCOUNT NUMBER', 'ABCDE1234F'].join('\n');
    mockRecognise.mockResolvedValue({ lines: [{ text: NO_NAME, confidence: 0.9 }], fullText: NO_NAME });
    await typeThenScan('Rahul Verma');

    await screen.findByText('ID scanned');
    expect(screen.queryByText(/the id names somebody else/i)).toBeNull();
  });

  it('says nothing when the two names agree', async () => {
    await typeThenScan('Rahul Verma');
    await screen.findByText('ID scanned');
    expect(screen.queryByText(/the id names somebody else/i)).toBeNull();
  });

  // The override is granted against ONE disagreement. Editing either side of it
  // makes a different comparison, which the guard has not judged.
  it('revokes the override when the typed name is edited afterwards', async () => {
    mockRecognise.mockResolvedValue({ lines: [{ text: MISMATCH, confidence: 0.9 }], fullText: MISMATCH });
    await typeThenScan('Rahul Verma');
    await screen.findByText(/the id names somebody else/i);
    fireEvent.click(screen.getByRole('button', { name: /send anyway/i }));

    const nameInput = screen.getAllByRole('textbox')[1];
    fireEvent.change(nameInput, { target: { value: 'Rahul V' } });

    expect(screen.queryByText(/overridden by you/i)).toBeNull();
    expect(screen.getByRole('button', { name: /send approval request/i })).toBeDisabled();
  });
});
