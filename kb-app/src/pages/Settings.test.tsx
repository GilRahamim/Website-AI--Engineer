import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { IDBFactory } from 'fake-indexeddb';
import Settings from './Settings';
import { useUserDataStore } from '../store/userDataStore';
import { useAuthStore } from '../store/authStore';
import * as db from '../lib/db';
import { __resetDbForTests, setProgress } from '../lib/db';

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
}

function validBackupFile(progress: unknown[] = [{ topicId: 'topic-a', status: 'mastered', updatedAt: 1 }]) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { progress, favorites: [], recents: [], notes: [], srsCards: [] },
  };
  return new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' });
}

beforeEach(() => {
  // eslint-disable-next-line no-global-assign
  indexedDB = new IDBFactory();
  __resetDbForTests();
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
  useAuthStore.setState({ email: null, status: 'idle', errorMessage: null });
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Settings — export', () => {
  it('renders an export button', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: 'ייצא את הנתונים שלי' })).toBeInTheDocument();
  });

  it('clicking export creates a blob URL from the current data', async () => {
    const user = userEvent.setup();
    await setProgress('topic-a', 'learning');
    renderSettings();

    await user.click(screen.getByRole('button', { name: 'ייצא את הנתונים שלי' }));

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    const [blobArg] = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(blobArg).toBeInstanceOf(Blob);
    const text = await (blobArg as Blob).text();
    expect(JSON.parse(text).data.progress).toEqual([{ topicId: 'topic-a', status: 'learning', updatedAt: expect.any(Number) }]);
  });

  it('names the downloaded file with today\'s local date', async () => {
    const user = userEvent.setup();
    const realCreateElement = document.createElement.bind(document);
    let anchor: HTMLAnchorElement | undefined;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag);
      if (tag === 'a') anchor = el as HTMLAnchorElement;
      return el;
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderSettings();
    await user.click(screen.getByRole('button', { name: 'ייצא את הנתונים שלי' }));

    await waitFor(() => expect(anchor).toBeDefined());
    const today = new Date();
    const expectedName = `kb-backup-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.json`;
    expect(anchor?.download).toBe(expectedName);
  });
});

describe('Settings — account', () => {
  it('renders the signed-out email form', () => {
    renderSettings();
    expect(screen.getByLabelText('כתובת אימייל')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'שלח קישור התחברות' })).toBeInTheDocument();
  });

  it('submitting the form calls sendMagicLink with the entered email', async () => {
    const user = userEvent.setup();
    const sendMagicLinkSpy = vi.spyOn(useAuthStore.getState(), 'sendMagicLink').mockImplementation(async () => {
      useAuthStore.setState({ status: 'sent' });
    });
    renderSettings();

    await user.type(screen.getByLabelText('כתובת אימייל'), 'a@b.com');
    await user.click(screen.getByRole('button', { name: 'שלח קישור התחברות' }));

    expect(sendMagicLinkSpy).toHaveBeenCalledWith('a@b.com');
    expect(await screen.findByRole('status')).toHaveTextContent('קישור נשלח ל-\u2066a@b.com\u2069');
  });

  it('disables the submit button while sending, and re-enables after', async () => {
    const user = userEvent.setup();
    let resolveSend: () => void = () => {};
    vi.spyOn(useAuthStore.getState(), 'sendMagicLink').mockImplementation(() => {
      useAuthStore.setState({ status: 'sending' });
      return new Promise((resolve) => {
        resolveSend = () => {
          useAuthStore.setState({ status: 'sent' });
          resolve();
        };
      });
    });
    renderSettings();

    await user.type(screen.getByLabelText('כתובת אימייל'), 'a@b.com');
    const submitButton = screen.getByRole('button', { name: 'שלח קישור התחברות' });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    act(() => resolveSend());
    await waitFor(() => expect(submitButton).not.toBeDisabled());
  });

  it('shows an error message when sendMagicLink fails, form stays visible', async () => {
    const user = userEvent.setup();
    vi.spyOn(useAuthStore.getState(), 'sendMagicLink').mockImplementation(async () => {
      useAuthStore.setState({ status: 'error', errorMessage: 'שליחת הקישור נכשלה. נסה שוב.' });
    });
    renderSettings();

    await user.type(screen.getByLabelText('כתובת אימייל'), 'a@b.com');
    await user.click(screen.getByRole('button', { name: 'שלח קישור התחברות' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('שליחת הקישור נכשלה');
    expect(screen.getByLabelText('כתובת אימייל')).toBeInTheDocument();
  });

  it('shows the signed-in view with the user\'s email when signed in', () => {
    useAuthStore.setState({ email: 'signed-in@example.com' });
    renderSettings();

    expect(screen.getByText('מחובר כ: \u2066signed-in@example.com\u2069')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התנתק' })).toBeInTheDocument();
    expect(screen.queryByLabelText('כתובת אימייל')).not.toBeInTheDocument();
  });

  it('clicking sign out calls authStore.signOut', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ email: 'signed-in@example.com' });
    const signOutSpy = vi.spyOn(useAuthStore.getState(), 'signOut').mockResolvedValue(undefined);
    renderSettings();

    await user.click(screen.getByRole('button', { name: 'התנתק' }));

    expect(signOutSpy).toHaveBeenCalledTimes(1);
  });

  it('a stale message from one flow does not persist once a different flow completes', async () => {
    const user = userEvent.setup();
    vi.spyOn(useAuthStore.getState(), 'sendMagicLink').mockImplementation(async () => {
      useAuthStore.setState({ status: 'sent' });
    });
    renderSettings();

    await user.type(screen.getByLabelText('כתובת אימייל'), 'a@b.com');
    await user.click(screen.getByRole('button', { name: 'שלח קישור התחברות' }));
    expect(await screen.findByRole('status')).toHaveTextContent('קישור נשלח');

    await user.click(screen.getByRole('button', { name: 'ייצא את הנתונים שלי' }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));

    expect(screen.queryByText(/קישור נשלח/)).not.toBeInTheDocument();
  });
});

describe('Settings — import', () => {
  it('renders an import button and a hidden file input', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: 'ייבוא נתונים' })).toBeInTheDocument();
    expect(screen.getByLabelText('בחר קובץ גיבוי לייבוא')).toBeInTheDocument();
  });

  it('imports a valid file after confirmation, refreshes the store, and shows a success message', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderSettings();

    await user.upload(screen.getByLabelText('בחר קובץ גיבוי לייבוא'), validBackupFile());

    expect(await screen.findByRole('status')).toHaveTextContent('הנתונים יובאו בהצלחה');
    await waitFor(() => expect(useUserDataStore.getState().progress.get('topic-a')).toBe('mastered'));
  });

  it('shows a failure message and no success message when importAllData fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(db, 'importAllData').mockResolvedValue(false);
    renderSettings();

    await user.upload(screen.getByLabelText('בחר קובץ גיבוי לייבוא'), validBackupFile());

    expect(await screen.findByRole('alert')).toHaveTextContent('הייבוא נכשל');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does nothing when the user cancels the confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderSettings();

    await user.upload(screen.getByLabelText('בחר קובץ גיבוי לייבוא'), validBackupFile());

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(useUserDataStore.getState().progress.size).toBe(0);
  });

  it('shows an error and never prompts for confirmation when the file is not valid JSON', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderSettings();

    await user.upload(
      screen.getByLabelText('בחר קובץ גיבוי לייבוא'),
      new File(['not json'], 'bad.json', { type: 'application/json' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('קובץ לא תקין');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('shows an error when the JSON is well-formed but structurally invalid', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderSettings();

    await user.upload(
      screen.getByLabelText('בחר קובץ גיבוי לייבוא'),
      new File([JSON.stringify({ version: 1, data: { progress: [] } })], 'bad.json', { type: 'application/json' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('קובץ לא תקין');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('rejects a progress row with an invalid status value', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderSettings();

    await user.upload(
      screen.getByLabelText('בחר קובץ גיבוי לייבוא'),
      validBackupFile([{ topicId: 'topic-a', status: 'bogus', updatedAt: 1 }]),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('קובץ לא תקין');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('rejects a progress row missing updatedAt field', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderSettings();

    await user.upload(
      screen.getByLabelText('בחר קובץ גיבוי לייבוא'),
      validBackupFile([{ topicId: 'topic-a', status: 'mastered' }]),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('קובץ לא תקין');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('rejects a note row missing updatedAt field', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderSettings();

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { progress: [], favorites: [], recents: [], notes: [{ topicId: 'topic-a', text: 'my note' }], srsCards: [] },
    };
    await user.upload(
      screen.getByLabelText('בחר קובץ גיבוי לייבוא'),
      new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('קובץ לא תקין');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('rejects an srsCard row missing required fields', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderSettings();

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { progress: [], favorites: [], recents: [], notes: [], srsCards: [{ topicId: 'topic-a', ease: 2.5 }] },
    };
    await user.upload(
      screen.getByLabelText('בחר קובץ גיבוי לייבוא'),
      new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('קובץ לא תקין');
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
