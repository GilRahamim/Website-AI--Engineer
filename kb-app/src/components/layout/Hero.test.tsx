import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Hero from './Hero';

describe('Hero', () => {
  it('renders the topic and module counts', () => {
    render(<Hero topicCount={160} moduleCount={5} masteredCount={0} />);
    expect(screen.getByText('160')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders a heading', () => {
    render(<Hero topicCount={160} moduleCount={5} masteredCount={0} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders the mastered-topics stat, including the zero-mastered default', () => {
    render(<Hero topicCount={160} moduleCount={5} masteredCount={0} />);
    expect(screen.getByText('מתוך 160 נשלטו')).toBeInTheDocument();
  });

  it('reflects a non-zero mastered count', () => {
    render(<Hero topicCount={160} moduleCount={5} masteredCount={12} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
