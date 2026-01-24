import { StickerTemplate } from '@/types/overlays';

/**
 * Sticker templates - curated emojis and shapes for engagement
 */
export const stickerTemplates: StickerTemplate[] = [
  // Reactions
  { id: 'fire', emoji: '\u{1F525}', name: 'Fire', category: 'reactions' },
  { id: 'heart', emoji: '\u{2764}\u{FE0F}', name: 'Heart', category: 'reactions' },
  { id: 'hundred', emoji: '\u{1F4AF}', name: '100', category: 'reactions' },
  { id: 'star', emoji: '\u{2B50}', name: 'Star', category: 'reactions' },
  { id: 'thumbsup', emoji: '\u{1F44D}', name: 'Thumbs Up', category: 'reactions' },
  { id: 'clap', emoji: '\u{1F44F}', name: 'Clap', category: 'reactions' },
  { id: 'rocket', emoji: '\u{1F680}', name: 'Rocket', category: 'reactions' },
  { id: 'sparkles', emoji: '\u{2728}', name: 'Sparkles', category: 'reactions' },

  // Emotions
  { id: 'laugh', emoji: '\u{1F602}', name: 'Laugh', category: 'emotions' },
  { id: 'love-eyes', emoji: '\u{1F60D}', name: 'Love Eyes', category: 'emotions' },
  { id: 'surprised', emoji: '\u{1F62E}', name: 'Surprised', category: 'emotions' },
  { id: 'thinking', emoji: '\u{1F914}', name: 'Thinking', category: 'emotions' },
  { id: 'cool', emoji: '\u{1F60E}', name: 'Cool', category: 'emotions' },
  { id: 'wink', emoji: '\u{1F609}', name: 'Wink', category: 'emotions' },
  { id: 'mind-blown', emoji: '\u{1F92F}', name: 'Mind Blown', category: 'emotions' },
  { id: 'crying', emoji: '\u{1F62D}', name: 'Crying', category: 'emotions' },

  // Objects
  { id: 'crown', emoji: '\u{1F451}', name: 'Crown', category: 'objects' },
  { id: 'money', emoji: '\u{1F4B0}', name: 'Money', category: 'objects' },
  { id: 'lightning', emoji: '\u{26A1}', name: 'Lightning', category: 'objects' },
  { id: 'trophy', emoji: '\u{1F3C6}', name: 'Trophy', category: 'objects' },
  { id: 'gift', emoji: '\u{1F381}', name: 'Gift', category: 'objects' },
  { id: 'bell', emoji: '\u{1F514}', name: 'Bell', category: 'objects' },
  { id: 'gem', emoji: '\u{1F48E}', name: 'Gem', category: 'objects' },
  { id: 'megaphone', emoji: '\u{1F4E3}', name: 'Megaphone', category: 'objects' },

  // Shapes (using emoji squares/circles as basic shapes)
  { id: 'red-circle', emoji: '\u{1F534}', name: 'Red Circle', category: 'shapes' },
  { id: 'blue-circle', emoji: '\u{1F535}', name: 'Blue Circle', category: 'shapes' },
  { id: 'yellow-square', emoji: '\u{1F7E8}', name: 'Yellow Square', category: 'shapes' },
  { id: 'green-square', emoji: '\u{1F7E9}', name: 'Green Square', category: 'shapes' },
  { id: 'white-star', emoji: '\u{2606}', name: 'White Star', category: 'shapes' },
  { id: 'black-star', emoji: '\u{2605}', name: 'Black Star', category: 'shapes' },
  { id: 'arrow-right', emoji: '\u{27A1}\u{FE0F}', name: 'Arrow Right', category: 'shapes' },
  { id: 'arrow-down', emoji: '\u{2B07}\u{FE0F}', name: 'Arrow Down', category: 'shapes' },
];

export function getStickerById(id: string): StickerTemplate | undefined {
  return stickerTemplates.find(s => s.id === id);
}

export function getStickersByCategory(category: StickerTemplate['category']): StickerTemplate[] {
  return stickerTemplates.filter(s => s.category === category);
}

export const stickerCategories: { id: StickerTemplate['category']; name: string }[] = [
  { id: 'reactions', name: 'Reactions' },
  { id: 'emotions', name: 'Emotions' },
  { id: 'objects', name: 'Objects' },
  { id: 'shapes', name: 'Shapes' },
];
