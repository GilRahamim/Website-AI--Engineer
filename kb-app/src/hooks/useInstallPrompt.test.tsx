import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useInstallPrompt } from './useInstallPrompt';

function Harness() {
  const { canInstall, promptInstall } = useInstallPrompt();
  return (
    <div>
      <p>{canInstall ? 'can-install' : 'cannot-install'}</p>
      <button type="button" onClick={promptInstall}>
        install
      </button>
    </div>
  );
}

type MockBeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function makeBeforeInstallPromptEvent(promptSpy: () => Promise<void>): MockBeforeInstallPromptEvent {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as MockBeforeInstallPromptEvent;
  event.prompt = promptSpy;
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  return event;
}

describe('useInstallPrompt', () => {
  it('canInstall is false before any beforeinstallprompt event', () => {
    render(<Harness />);
    expect(screen.getByText('cannot-install')).toBeInTheDocument();
  });

  it('canInstall becomes true after a beforeinstallprompt event', () => {
    render(<Harness />);
    fireEvent(window, makeBeforeInstallPromptEvent(async () => {}));
    expect(screen.getByText('can-install')).toBeInTheDocument();
  });

  it('promptInstall calls prompt() on the captured event, then resets canInstall', async () => {
    const user = userEvent.setup();
    const promptSpy = vi.fn(async () => {});
    render(<Harness />);
    fireEvent(window, makeBeforeInstallPromptEvent(promptSpy));
    expect(screen.getByText('can-install')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'install' }));
    expect(promptSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('cannot-install')).toBeInTheDocument();
  });

  it('an appinstalled event clears canInstall', () => {
    render(<Harness />);
    fireEvent(window, makeBeforeInstallPromptEvent(async () => {}));
    expect(screen.getByText('can-install')).toBeInTheDocument();
    fireEvent(window, new Event('appinstalled'));
    expect(screen.getByText('cannot-install')).toBeInTheDocument();
  });

  it('clicking install clears canInstall immediately, even before prompt() resolves', async () => {
    const user = userEvent.setup();
    let resolvePrompt: () => void = () => {};
    const slowPrompt = vi.fn(() => new Promise<void>((resolve) => { resolvePrompt = resolve; }));
    render(<Harness />);
    fireEvent(window, makeBeforeInstallPromptEvent(slowPrompt));
    expect(screen.getByText('can-install')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'install' }));
    // canInstall clears synchronously — a second click can't re-trigger prompt().
    expect(screen.getByText('cannot-install')).toBeInTheDocument();
    expect(slowPrompt).toHaveBeenCalledTimes(1);
    resolvePrompt();
  });

  it('a rejecting prompt() does not throw or leave canInstall stuck true', async () => {
    const user = userEvent.setup();
    const rejectingPrompt = vi.fn(() => Promise.reject(new Error('The prompt() method may only be called once.')));
    render(<Harness />);
    fireEvent(window, makeBeforeInstallPromptEvent(rejectingPrompt));
    expect(screen.getByText('can-install')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'install' }));
    expect(screen.getByText('cannot-install')).toBeInTheDocument();
  });
});
