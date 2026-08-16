// The `datetime-local` field with an explicit confirm step
// (src/components/DateTimeField.tsx). The native picker has no OK button on any
// desktop browser, so an HOD could not tell whether the slot they had just
// clicked was the slot the form was holding (client report, 2026-08-16).
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import DateTimeField from '../../../src/components/DateTimeField';

afterEach(cleanup);

function renderField(props: Partial<React.ComponentProps<typeof DateTimeField>> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <DateTimeField id="slot" label="Schedule for *" value="" onChange={onChange} {...props} />,
  );
  return { ...utils, onChange };
}

describe('DateTimeField', () => {
  it('labels the input and wires the label to it', () => {
    renderField();
    expect(screen.getByLabelText('Schedule for *')).toBeInTheDocument();
  });

  // The OK button is the whole point of this component. It must not be on
  // screen before the approver has engaged with the field, or it reads as an
  // action pending on an empty form.
  it('shows no OK button until the field is touched or already holds a value', () => {
    renderField();
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull();
  });

  it('offers OK once the picker has been opened', () => {
    renderField();
    fireEvent.focus(screen.getByLabelText('Schedule for *'));
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('offers OK for a field that already carries a value', () => {
    renderField({ value: '2026-08-20T15:30' });
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  // OK cannot confirm nothing. A button that looks pressable but stores an
  // empty slot is worse than no button: the approver believes they confirmed.
  it('disables OK while the field is empty', () => {
    renderField();
    fireEvent.focus(screen.getByLabelText('Schedule for *'));
    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
  });

  // The echo is the load-bearing half. `scheduled_for` is converted out of the
  // browser's wall clock into IST before it is written, so the only honest way
  // to show an approver what they booked is to run the same conversion and
  // print the result. 15:30 IST is 10:00 UTC, and the echo must read the IST
  // side whatever timezone the machine running this test is set to.
  it('echoes the chosen slot back in IST, not as the raw input string', () => {
    renderField({ value: '2026-08-20T15:30' });
    expect(screen.getByText(/Selected:/)).toBeInTheDocument();
    expect(screen.getByText(/3:30 pm|03:30 pm/i)).toBeInTheDocument();
    expect(screen.getByText(/20 Aug 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/2026-08-20T15:30/)).toBeNull();
  });

  it('shows no echo while there is nothing chosen', () => {
    renderField();
    expect(screen.queryByText(/Selected:/)).toBeNull();
  });

  it('reports edits to the caller', () => {
    const { onChange } = renderField();
    fireEvent.change(screen.getByLabelText('Schedule for *'), {
      target: { value: '2026-08-20T15:30' },
    });
    expect(onChange).toHaveBeenCalledWith('2026-08-20T15:30');
  });

  // A lower bound belongs on the input itself: an expected departure at or
  // before the arrival is rejected by `validatePreApproval` and by the
  // `visits_departure_after_arrival` CHECK, so the field should not invite it.
  it('passes a min through to the input', () => {
    renderField({ value: '', min: '2026-08-20T09:00' });
    expect(screen.getByLabelText('Schedule for *')).toHaveAttribute('min', '2026-08-20T09:00');
  });

  it('renders the hint when one is given, and nothing when not', () => {
    const { unmount } = renderField({ hint: 'Set this for overnight visits.' });
    expect(screen.getByText('Set this for overnight visits.')).toBeInTheDocument();
    unmount();
    renderField();
    expect(screen.queryByText('Set this for overnight visits.')).toBeNull();
  });
});
