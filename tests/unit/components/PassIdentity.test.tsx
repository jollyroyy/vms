import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import PassIdentity from '../../../src/components/PassIdentity';
import type { PassIdentityProps } from '../../../src/components/PassIdentity';

afterEach(cleanup);

const baseProps: PassIdentityProps = {
  name: 'John Doe',
  vendorName: 'Acme Corp',
  idType: 'Aadhaar',
  idLast4: '9646',
  photoUrl: 'https://example.com/photo.jpg',
};

describe('PassIdentity', () => {
  it('renders the visitor name', () => {
    render(<PassIdentity {...baseProps} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('renders the photo with alt="Visitor photo" and the right src when photoUrl is given', () => {
    render(<PassIdentity {...baseProps} />);
    const img = screen.getByAltText('Visitor photo');
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('renders the placeholder and NO Visitor photo img when photoUrl is null', () => {
    render(<PassIdentity {...baseProps} photoUrl={null} />);
    expect(screen.queryByAltText('Visitor photo')).not.toBeInTheDocument();
    expect(screen.getByLabelText('No visitor photo on record')).toBeInTheDocument();
  });

  it('renders "Aadhaar ••••46" for idType=Aadhaar and idLast4=9646', () => {
    render(<PassIdentity {...baseProps} />);
    expect(screen.getByText(/Aadhaar ••••46/)).toBeInTheDocument();
  });

  it('never shows the full ID 9646 in the document', () => {
    render(<PassIdentity {...baseProps} />);
    expect(screen.queryByText(/9646/)).not.toBeInTheDocument();
  });

  it('renders — for the ID when there is no idLast4, and still renders the ID Proof label', () => {
    render(<PassIdentity {...baseProps} idLast4={null} />);
    expect(screen.getByText(/ID Proof/)).toBeInTheDocument();
    const idProofLabel = screen.getByText(/ID Proof/);
    const idProofRow = idProofLabel.parentElement;
    expect(idProofRow).toHaveTextContent('—');
  });

  it('renders the vendor name when given, and does not render an empty vendor name element when it is null', () => {
    const { rerender } = render(<PassIdentity {...baseProps} />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();

    rerender(<PassIdentity {...baseProps} vendorName={null} />);
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  it('renders both size values without throwing', () => {
    const { rerender } = render(<PassIdentity {...baseProps} size="lg" />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    rerender(<PassIdentity {...baseProps} size="sm" />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
