import { Star } from 'lucide-react';
import { useUserDataStore } from '../../store/userDataStore';

interface TopicFavoriteButtonProps {
  topicId: string;
  size?: 'xs' | 'sm' | 'lg';
  tabIndex?: number;
}

const SIZE_CLASS: Record<'xs' | 'sm' | 'lg', string> = {
  xs: 'size-9',
  sm: 'size-11',
  lg: 'size-12',
};

const ICON_SIZE: Record<'xs' | 'sm' | 'lg', number> = {
  xs: 15,
  sm: 18,
  lg: 22,
};

export default function TopicFavoriteButton({ topicId, size = 'sm', tabIndex = 0 }: TopicFavoriteButtonProps) {
  const isFavorite = useUserDataStore((s) => s.favorites.has(topicId));
  const toggleFavorite = useUserDataStore((s) => s.toggleFavorite);

  return (
    <button
      type="button"
      tabIndex={tabIndex}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(topicId);
      }}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
      className={`kb-favorite-star grid place-items-center rounded-full border border-[var(--kb-border)] bg-[var(--kb-surface)] ${SIZE_CLASS[size]}`}
    >
      <Star aria-hidden="true" size={ICON_SIZE[size]} fill={isFavorite ? 'currentColor' : 'none'} />
    </button>
  );
}
