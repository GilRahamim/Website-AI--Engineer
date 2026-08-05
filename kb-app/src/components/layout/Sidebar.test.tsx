import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';
import { useUiStore } from '../../store/uiStore';

const modules = { 'Intro to Data Science': 'מבוא למדעי הנתונים', 'Topic 3 - Deep Learning': 'Deep Learning' };
const moduleCounts = { 'Intro to Data Science': 8, 'Topic 3 - Deep Learning': 43 };
const categoryLabels = { algorithms: 'אלגוריתמים', concepts: 'מושגים' };
const categoryCounts = { algorithms: 45, concepts: 69 };

function reset() {
  useUiStore.setState({ selectedModules: new Set(), selectedCategories: new Set(), sidebarCollapsed: false });
}

describe('Sidebar', () => {
  beforeEach(reset);

  it('lists every module with its label and count', () => {
    render(
      <Sidebar modules={modules} moduleCounts={moduleCounts} categoryLabels={categoryLabels} categoryCounts={categoryCounts} />,
    );
    expect(screen.getByText('מבוא למדעי הנתונים')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('lists every category with its label and count', () => {
    render(
      <Sidebar modules={modules} moduleCounts={moduleCounts} categoryLabels={categoryLabels} categoryCounts={categoryCounts} />,
    );
    expect(screen.getByText('אלגוריתמים')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('toggles a module filter in the store when clicked', async () => {
    const user = userEvent.setup();
    render(
      <Sidebar modules={modules} moduleCounts={moduleCounts} categoryLabels={categoryLabels} categoryCounts={categoryCounts} />,
    );
    await user.click(screen.getByRole('button', { name: /מבוא למדעי הנתונים/ }));
    expect(useUiStore.getState().selectedModules.has('Intro to Data Science')).toBe(true);
  });

  it('reflects an active module filter via aria-pressed', async () => {
    const user = userEvent.setup();
    render(
      <Sidebar modules={modules} moduleCounts={moduleCounts} categoryLabels={categoryLabels} categoryCounts={categoryCounts} />,
    );
    const button = screen.getByRole('button', { name: /מבוא למדעי הנתונים/ });
    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('has a mobile-drawer toggle button with aria-expanded', () => {
    render(
      <Sidebar modules={modules} moduleCounts={moduleCounts} categoryLabels={categoryLabels} categoryCounts={categoryCounts} />,
    );
    expect(screen.getByRole('button', { name: 'פתח/סגור תפריט' })).toHaveAttribute('aria-expanded');
  });
});
