import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { IDBFactory } from 'fake-indexeddb';
import Settings from './Settings';
import { useUserDataStore } from '../store/userDataStore';
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
