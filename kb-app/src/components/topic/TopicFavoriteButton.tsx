import { useUserDataStore } from '../../store/userDataStore';

interface TopicFavoriteButtonProps {
  topicId: string;
  size?: 'sm' | 'lg';
  tabIndex?: number;
}

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
      className={`kb-favorite-star grid place-items-center rounded-full border border-[var(--kb-border)] bg-[var(--kb-surface)] ${
        size === 'lg' ? 'size-12 text-2xl' : 'size-11 text-base'
      }`}
    >
      <span aria-hidden="true">{isFavorite ? '★' : '☆'}</span>
    </button>
  );
}
