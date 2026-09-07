import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';
import { useUserDataStore } from '../../store/userDataStore';
import topicsData from '../../data/topics.clean.json';

function reset() {
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
}

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
}

type MockBeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function dispatchBeforeInstallPrompt(promptSpy: () => Promise<void>) {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as MockBeforeInstallPromptEvent;
  event.prompt = promptSpy;
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  fireEvent(window, event);
}

describe('Header', () => {
  beforeEach(reset);

  it('renders the brand name', () => {
    renderWithRouter();
    expect(screen.getByText('מסד ידע')).toBeInTheDocument();
    expect(screen.getByText('AI Engineer')).toBeInTheDocument();
  });

  it('renders the theme toggle button', () => {
    renderWithRouter();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('uses the header landmark', () => {
    renderWithRouter();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders a link to the Flashcards page', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: /כרטיסיות/ })).toHaveAttribute('href', '/flashcards');
  });

  it('renders a link to the Quiz page', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: 'מבחן' })).toHaveAttribute('href', '/quiz');
  });

  it('renders a link to the Map page', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: 'מפה' })).toHaveAttribute('href', '/map');
  });

  it('shows a due-count badge when cards are due (every topic starts never-reviewed = due)', () => {
    renderWithRouter();
    expect(screen.getByLabelText(`${topicsData.length} כרטיסים ממתינים לחזרה`)).toBeInTheDocument();
  });

  it('hides the badge when nothing is due', () => {
    const now = Date.now();
    const farFuture = now + 1000 * 60 * 60 * 24 * 365;
    const allNotDue = new Map(
      topicsData.map((t) => [
        t.id,
        { topicId: t.id, ease: 2.5, intervalDays: 365, dueAt: farFuture, reps: 1, lapses: 0, updatedAt: now },
      ]),
    );
    useUserDataStore.setState({ srsCards: allNotDue });
    renderWithRouter();
    expect(screen.queryByText(/כרטיסים ממתינים לחזרה/)).not.toBeInTheDocument();
  });

  it('does not render an install button by default', () => {
    renderWithRouter();
    expect(screen.queryByRole('button', { name: /התקן אפליקציה/ })).not.toBeInTheDocument();
  });

  it('renders an install button after a beforeinstallprompt event, and calls promptInstall on click', async () => {
    const user = userEvent.setup();
    renderWithRouter();
    const promptSpy = vi.fn(async () => {});
    dispatchBeforeInstallPrompt(promptSpy);
    const installButton = screen.getByRole('button', { name: /התקן אפליקציה/ });
    await user.click(installButton);
    expect(promptSpy).toHaveBeenCalledTimes(1);
  });
});
