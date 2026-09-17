import { Star } from 'lucide-react';
import { useUserDataStore } from '../../store/userDataStore';
import { Toggle } from '@/components/ui/toggle';

interface TopicFavoriteButtonProps {
  topicId: string;
  size?: 'xs' | 'sm' | 'lg';
  tabIndex?: number;
}

const SIZE_CLASS: Record<'xs' | 'sm' | 'lg', string> = {
  xs: 'size-9 min-w-0 p-0',
  sm: 'size-11 min-w-0 p-0',
  lg: 'size-12 min-w-0 p-0',
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
    <Toggle
      tabIndex={tabIndex}
      pressed={isFavorite}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(topicId);
      }}
      aria-label={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
      className={`kb-favorite-star grid place-items-center rounded-full border border-input bg-background data-[state=on]:bg-background data-[state=on]:text-[var(--kb-accent)] ${SIZE_CLASS[size]}`}
    >
      <Star aria-hidden="true" size={ICON_SIZE[size]} fill={isFavorite ? 'currentColor' : 'none'} />
    </Toggle>
  );
}
