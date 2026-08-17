// Handing the entry pass to the visitor, from the approver's own phone.
//
// Client question, 2026-08-17: after an HOD raises a pre-approval, can the pass
// be forwarded straight to the visitor's mobile or WhatsApp number? This module
// is the answer that needs no Meta Business account, no verified sender number,
// no template approval and no per-message cost — the HOD taps once and their own
// WhatsApp opens with the visitor's chat and the pass ready to send. It is a
// SHORTCUT TO A HUMAN ACTION, not automated messaging, which is also why no
// TRAI/DLT registration comes into it: that framework governs bulk commercial
// traffic over telecom operators, not a person forwarding one message.
//
// TWO MECHANISMS, AND NEITHER IS OPTIONAL — they do different halves of the job.
//
//   1. The Web Share API carries the FILE. `navigator.share({ files })` opens
//      the OS share sheet with the pass PNG attached; the HOD picks WhatsApp and
//      the image goes as an image. Supported on Chrome/Android, Safari on
//      iOS 14+ and macOS, Chrome/Edge on desktop (OS-dependent there); Firefox
//      has none of it. This is the good path and it is the one a phone takes.
//
//   2. `wa.me` carries the RECIPIENT. A click-to-chat link opens the visitor's
//      own chat with the message prefilled. What it categorically CANNOT do is
//      attach anything — there is no parameter for a file in the click-to-chat
//      spec and there never has been. So this path sends the pass details as
//      text and the caller downloads the PNG alongside for the HOD to attach.
//
// The share sheet knows the file but not the recipient; the link knows the
// recipient but not the file. Offering only one of them would either drop the
// pass or make the HOD find the visitor in their contacts by hand.
//
// TRANSIENT ACTIVATION IS THE TRAP. `navigator.share` throws unless it is called
// inside a real user gesture, and an `await` before it can spend that gesture on
// a slow tick. Everything here is therefore SYNCHRONOUS up to the `share()` call
// itself: `dataUrlToFile` does no I/O, and the QR data URL is already resolved
// in component state by the time the button can be pressed. Do not insert a
// fetch, a canvas re-encode or a PDF build in front of it.
import type { Visit } from '../types/index';
import { normalizePhone } from './blacklist';
import { formatDateTime } from './formatDate';

/** India. `normalizePhone` strips +91 and trunk zeros down to the bare subscriber
 *  number, and wa.me wants a full international number with no `+` and no
 *  punctuation — so the code goes back on here rather than being guessed at the
 *  call site. A number that is already 11+ digits after normalisation is not an
 *  Indian mobile and is passed through untouched. */
const IN_COUNTRY_CODE = '91';

/** Digits only, country code included, no `+` — the only format wa.me accepts.
 *  Returns null for anything `normalizePhone` refuses, so a malformed number
 *  degrades to "no recipient" rather than opening a chat with the wrong person. */
export function waPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const local = normalizePhone(raw);
    return local.length === 10 ? `${IN_COUNTRY_CODE}${local}` : local;
  } catch {
    return null;
  }
}

/** The message body. Plain text, no markdown — WhatsApp renders its own, and a
 *  stray asterisk in a company name would bold half the message.
 *
 *  It repeats what is ON the pass rather than replacing it: the visitor may read
 *  this on a locked screen without opening the image, and the reference number
 *  is what the guard asks for when the QR will not scan. */
export function passShareMessage(visit: Visit): string {
  const lines = [
    `Your visit is confirmed. Please show this pass at the gate.`,
    ``,
    `Reference: ${visit.ref_number}`,
  ];
  if (visit.host?.full_name) {
    lines.push(`Meeting: ${visit.host.full_name}${visit.department?.name ? ` (${visit.department.name})` : ''}`);
  }
  if (visit.scheduled_for) lines.push(`When: ${formatDateTime(visit.scheduled_for)}`);
  lines.push(``, `Please carry a government photo ID.`);
  return lines.join('\n');
}

/** A click-to-chat link. With no usable number it still returns a link — one
 *  with no recipient, which opens WhatsApp on the contact picker. That is the
 *  right degradation: the HOD picks the visitor themselves rather than the
 *  button doing nothing and looking broken. */
export function waMeUrl(phone: string | null, text: string): string {
  const encoded = encodeURIComponent(text);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

/** Decodes a `data:image/png;base64,…` URL into a File, synchronously.
 *
 *  `fetch(dataUrl).then(r => r.blob())` is the tidier spelling and is exactly
 *  what must not be used here — it returns a promise, and awaiting it before
 *  `navigator.share` spends the user gesture the share call requires. */
export function dataUrlToFile(dataUrl: string, filename: string): File | null {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  const meta = dataUrl.slice(0, comma);
  if (!meta.includes(';base64')) return null;
  const mime = meta.slice(5, meta.indexOf(';'));
  try {
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  } catch {
    return null;
  }
}

/** Can this browser hand the pass image to another app? False on Firefox, on
 *  http origins, and on anything without the files parameter — `canShare` is
 *  specified to return false rather than throw, which is why it is the gate. */
export function canSharePassFile(file: File | null): boolean {
  if (!file) return false;
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'dismissed' | 'unsupported';

/**
 * Opens the OS share sheet with the pass image attached.
 *
 * MUST be called from inside a click handler with nothing awaited before it.
 * `file` is built by the caller — synchronously, from a data URL already in
 * state — for exactly that reason.
 *
 * A user who opens the sheet and backs out rejects with `AbortError`, which is
 * not a failure and must not fall through to the wa.me path: they already chose
 * not to send. Anything else means the sheet could not open at all, and the
 * caller should fall back.
 */
export async function sharePassFile(visit: Visit, file: File): Promise<ShareOutcome> {
  try {
    await navigator.share({
      files: [file],
      // No `url`. Some targets append it as a second line and this app has no
      // public page for a visit to link to.
      title: `Entry pass ${visit.ref_number}`,
      text: passShareMessage(visit),
    });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'dismissed';
    return 'unsupported';
  }
}
