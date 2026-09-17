import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FinishTopicAction from './FinishTopicAction';
import { useUserDataStore } from '../../store/userDataStore';
import { useSyncStore } from '../../store/syncStore';
import { getPathPrevNext, pathTopics } from '../../lib/learningPath';
import type { ProgressStatus, Topic } from '../../types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function topic(overrides: Partial<Topic>): Topic {
  return {
    id: 'topic-a',
    module: 'Intro to Data Science',
    module_label: 'מבוא למדעי הנתונים',
    category: 'algorithms',
    category_label: 'אלגוריתמים',
    num: 1,
    slug_name: 'a',
    title: 'Topic A',
    definition: '',
    related_raw: [],
    related_match: [],
    contentPath: '/topic-content/a.html',
    ...overrides,
  };
}

const first = topic({ id: 'topic-a', module: 'Intro to Data Science', num: 1 });
const second = topic({ id: 'topic-b', module: 'Intro to Data Science', num: 2, title: 'Topic B' });

function reset() {
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
  mockNavigate.mockClear();
  // setStatus (via handleFinish) triggers scheduleSyncPush's dynamic
  // import('./syncStore') — pre-warm and stub it here so it can't fire a
  // dangling call past this test's lifetime (same hazard/fix as Quiz.test.tsx).
  vi.spyOn(useSyncStore.getState(), 'scheduleDirtyPush').mockImplementation(() => {});
}

function renderAction(topic: Topic, next: Topic | null) {
  return render(
    <MemoryRouter>
      <FinishTopicAction topic={topic} next={next} />
    </MemoryRouter>,
  );
}

describe('FinishTopicAction', () => {
  beforeEach(reset);

  it('renders nothing once the topic is already mastered', () => {
    useUserDataStore.setState({ progress: new Map([[first.id, 'mastered']]) });
    const { container } = renderAction(first, second);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the topic mastered and navigates to the next topic when the module is not yet complete', async () => {
    const user = userEvent.setup();
    renderAction(first, second);
    await user.click(screen.getByRole('button', { name: /סמן כנלמד והמשך/ }));
    expect(useUserDataStore.getState().progress.get(first.id)).toBe('mastered');
    expect(mockNavigate).toHaveBeenCalledWith(`/topic/${encodeURIComponent(second.id)}`);
  });

  // isModuleComplete (called with no override) checks against the real
  // catalog's path, so "finishing a module" has to be set up with real
  // topics, not the fake fixture above — mirrors Home.test.tsx/Path.test.tsx.
  function realModuleTopics(): Topic[] {
    const moduleKey = pathTopics[0].module;
    return pathTopics.filter((t) => t.module === moduleKey);
  }

  it('offers a module quiz instead of auto-navigating once the topic finishes the module', async () => {
    const moduleTopics = realModuleTopics();
    const target = moduleTopics[moduleTopics.length - 1];
    const alreadyMastered = new Map<string, ProgressStatus>(
      moduleTopics.slice(0, -1).map((t) => [t.id, 'mastered']),
    );
    useUserDataStore.setState({ progress: alreadyMastered });
    const { next } = getPathPrevNext(target, pathTopics);
    const user = userEvent.setup();
    renderAction(target, next);
    await user.click(screen.getByRole('button', { name: /סמן כנלמד והמשך/ }));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(target.module_label);
    const quizLink = screen.getByRole('link', { name: /בוחן קצר על המודול/ });
    expect(quizLink).toHaveAttribute('href', '/quiz');
    if (next) {
      expect(screen.getByRole('link', { name: 'המשך לנושא הבא' })).toHaveAttribute(
        'href',
        `/topic/${encodeURIComponent(next.id)}`,
      );
    }
  });

  it('tells the user they finished everything when the completed module has no next topic', async () => {
    const moduleTopics = realModuleTopics();
    const target = moduleTopics[moduleTopics.length - 1];
    const alreadyMastered = new Map<string, ProgressStatus>(
      moduleTopics.slice(0, -1).map((t) => [t.id, 'mastered']),
    );
    useUserDataStore.setState({ progress: alreadyMastered });
    const user = userEvent.setup();
    renderAction(target, null);
    await user.click(screen.getByRole('button', { name: /סמן כנלמד והמשך/ }));
    expect(screen.queryByRole('link', { name: 'המשך לנושא הבא' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /בוחן קצר על המודול/ })).toBeInTheDocument();
  });
});
