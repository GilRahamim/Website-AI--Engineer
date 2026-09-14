import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';
import { useUserDataStore } from '../../store/userDataStore';
import { useUiStore } from '../../store/uiStore';
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

function renderWithRouter(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
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
    expect(screen.getByText('AI Engineer')).toBeInTheDocument();
  });

  it('renders the theme toggle button', () => {
    renderWithRouter();
    expect(screen.getByRole('button', { name: /ערכת נושא/ })).toBeInTheDocument();
  });

  it('renders a home link in the nav and marks the current page with aria-current', () => {
    renderWithRouter('/quiz');
    expect(screen.getByRole('link', { name: 'בית' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'מבחן' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'בית' })).not.toHaveAttribute('aria-current');
  });

  it('renders a search control that opens the command palette', async () => {
    const user = userEvent.setup();
    const listener = vi.fn();
    window.addEventListener('kb-open-palette', listener);
    renderWithRouter();
    await user.click(screen.getByRole('button', { name: /חיפוש מהיר/ }));
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('kb-open-palette', listener);
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

  it('renders a link to the Settings page', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: 'הגדרות' })).toHaveAttribute('href', '/settings');
  });

  it('shows no badge for a fresh user (never-reviewed topics are new, not due)', () => {
    renderWithRouter();
    expect(screen.queryByText(/כרטיסים ממתינים לחזרה/)).not.toBeInTheDocument();
  });

  it('shows a due-count badge counting only scheduled cards whose review date has arrived', () => {
    const now = Date.now();
    useUserDataStore.setState({
      srsCards: new Map([
        [topicsData[0].id, { topicId: topicsData[0].id, ease: 2.5, intervalDays: 1, dueAt: now - 1, reps: 1, lapses: 0, updatedAt: now }],
        [topicsData[1].id, { topicId: topicsData[1].id, ease: 2.5, intervalDays: 9, dueAt: now + 86400000, reps: 1, lapses: 0, updatedAt: now }],
      ]),
    });
    renderWithRouter();
    expect(screen.getByLabelText('1 כרטיסים ממתינים לחזרה')).toBeInTheDocument();
  });

  it('renders a menu button that opens the mobile drawer via the ui store', async () => {
    const user = userEvent.setup();
    useUiStore.setState({ drawerOpen: false });
    renderWithRouter();
    const menu = screen.getByRole('button', { name: 'פתח תפריט' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await user.click(menu);
    expect(useUiStore.getState().drawerOpen).toBe(true);
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
