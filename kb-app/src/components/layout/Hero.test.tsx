import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Hero from './Hero';

describe('Hero', () => {
  it('renders the topic and module counts', () => {
    render(<Hero topicCount={160} moduleCount={5} />);
    expect(screen.getByText('160')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders a heading', () => {
    render(<Hero topicCount={160} moduleCount={5} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
