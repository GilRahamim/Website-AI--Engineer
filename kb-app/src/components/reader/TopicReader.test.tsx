import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TopicReader from './TopicReader';
import { useUserDataStore } from '../../store/userDataStore';
import { useUiStore } from '../../store/uiStore';
import type { Topic } from '../../types';

const topic: Topic = {
  id: 'Intro to Data Science::algorithms::02_Linear_Regression.docx',
  module: 'Intro to Data Science',
  module_label: 'מבוא למדעי הנתונים',
  category: 'algorithms',
  category_label: 'אלגוריתמים',
  num: 2,
  slug_name: 'Linear Regression',
  title: 'Linear Regression — רגרסיה לינארית',
  definition: 'שיטת למידה מונחית לחיזוי ערך רציף.',
  related_raw: ['Related Topic', 'R²'],
  related_match: ['related-id', null],
  contentPath: '/topic-content/x.html',
};

const relatedTopic: Topic = { ...topic, id: 'related-id', title: 'Related Topic', num: 3, related_raw: [], related_match: [] };
const topics = [topic, relatedTopic];
const topicsById = new Map(topics.map((t) => [t.id, t]));

const CONTENT = "<h4 class='sec-h'>הגדרה</h4><p>תוכן הנושא המלא</p><h4 class='sec-h'>השוואה</h4><p>עוד</p>";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(CONTENT),
  }) as unknown as typeof fetch;
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderWithRouter(current: Topic = topic) {
  return render(
    <MemoryRouter>
      <TopicReader topic={current} topics={topics} topicsById={topicsById} />
    </MemoryRouter>,
  );
}

describe('TopicReader', () => {
  it('renders the breadcrumb, category badge, title and definition', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: 'מבוא למדעי הנתונים' })).toHaveAttribute('href', '/');
    expect(screen.getByText('אלגוריתמים')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: topic.title })).toBeInTheDocument();
    expect(screen.getByText(topic.definition)).toBeInTheDocument();
  });

  it('narrows the Home module filter to this module when the breadcrumb module link is used', async () => {
    const user = userEvent.setup();
    useUiStore.setState({ selectedModules: new Set(['Some other module']) });
    renderWithRouter();
    await user.click(screen.getByRole('link', { name: 'מבוא למדעי הנתונים' }));
    expect([...useUiStore.getState().selectedModules]).toEqual(['Intro to Data Science']);
  });

  it('wraps the table of contents in a disclosure on narrow viewports (matchMedia false in jsdom)', async () => {
    renderWithRouter();
    await screen.findByRole('navigation', { name: 'בעמוד זה' });
    const summary = screen.getByText(/בעמוד זה · 2 סעיפים/);
    expect(summary.closest('details')).not.toBeNull();
  });

  it('shows a busy skeleton with an accessible loading label before the content arrives', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    renderWithRouter();
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('טוען תוכן');
  });

  it('shows the topic position within its module', () => {
    renderWithRouter();
    expect(screen.getByText('נושא 1 מתוך 2 במודול')).toBeInTheDocument();
  });

  it('fetches and renders the full content from contentPath', async () => {
    renderWithRouter();
    expect(fetch).toHaveBeenCalledWith('/topic-content/x.html');
    await waitFor(() => expect(screen.getByText('תוכן הנושא המלא')).toBeInTheDocument());
  });

  it('shows an estimated reading time once the content has loaded', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByText(/דקת קריאה|דקות קריאה/)).toBeInTheDocument());
  });

  it('builds a table of contents from the content headings and scrolls to a selected one', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const user = userEvent.setup();
    renderWithRouter();
    const toc = await screen.findByRole('navigation', { name: 'בעמוד זה' });
    expect(toc).toHaveTextContent('הגדרה');
    expect(toc).toHaveTextContent('השוואה');
    await user.click(screen.getByRole('link', { name: 'השוואה' }));
    expect(scrollIntoView).toHaveBeenCalled();
    expect(document.getElementById('sec-2')).toHaveTextContent('השוואה');
  });

  it('renders previous/next navigation along the learning path', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: /הבא.*Related Topic/ })).toHaveAttribute(
      'href',
      `/topic/${encodeURIComponent(relatedTopic.id)}`,
    );
    expect(screen.queryByRole('link', { name: /הקודם/ })).not.toBeInTheDocument();
  });

  it('crosses into the next module instead of stopping at the end of the current one', () => {
    const lastOfModule: Topic = { ...topic, id: 'last-of-module', num: 99 };
    const firstOfNextModule: Topic = {
      ...topic,
      id: 'first-of-next-module',
      module: 'Topic 1 - Unsupervised Learning',
      module_label: 'נושא 1',
      num: 1,
    };
    render(
      <MemoryRouter>
        <TopicReader
          topic={lastOfModule}
          topics={[lastOfModule, firstOfNextModule]}
          topicsById={new Map([[lastOfModule.id, lastOfModule], [firstOfNextModule.id, firstOfNextModule]])}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: new RegExp(`הבא.*${firstOfNextModule.title}`) })).toHaveAttribute(
      'href',
      `/topic/${encodeURIComponent(firstOfNextModule.id)}`,
    );
  });

  it('renders resolved related topics and unresolved names', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Related Topic' })).toBeInTheDocument());
    expect(screen.getByText('R² (לא במאגר)')).toBeInTheDocument();
  });

  it('renders an error state when the content fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve(''),
    }) as unknown as typeof fetch;
    renderWithRouter();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('שגיאה בטעינת התוכן'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders an error state when the content fetch rejects', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;
    renderWithRouter();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('שגיאה בטעינת התוכן'));
  });

  it('renders an offline-specific message when the fetch rejects while navigator.onLine is false', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    global.fetch = vi.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;
    renderWithRouter();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('אין חיבור לאינטרנט — ניתן לצפות רק בנושאים שנצפו כבר.'),
    );
  });

  it('renders the learning-state control and favorite button for the topic', () => {
    renderWithRouter();
    expect(screen.getByRole('radiogroup', { name: 'מצב למידה' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /מועדפים/ })).toBeInTheDocument();
  });

  it('shows the next review date from the SRS card', () => {
    const now = Date.now();
    useUserDataStore.setState({
      srsCards: new Map([
        [topic.id, { topicId: topic.id, ease: 2.5, intervalDays: 4, dueAt: now + 4 * 86400000, reps: 3, lapses: 0, updatedAt: now }],
      ]),
    });
    renderWithRouter();
    expect(screen.getByText(/חזרה הבאה בעוד 4 ימים/)).toBeInTheDocument();
  });

  it('renders the personal notes textarea and focuses it on the N shortcut', () => {
    renderWithRouter();
    const notes = screen.getByLabelText('ההערות שלי');
    fireEvent.keyDown(window, { key: 'n' });
    expect(notes).toHaveFocus();
  });
});
