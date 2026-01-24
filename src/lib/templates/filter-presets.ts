import { FilterPreset } from '@/types/overlays';

/**
 * Video filter presets using CSS filter property
 * Curated for short-form video content
 */
export const filterPresets: FilterPreset[] = [
  {
    id: 'none',
    name: 'None',
    filter: 'none',
    thumbnail: 'linear-gradient(135deg, #1a1a1a 0%, #333 100%)',
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    filter: 'contrast(1.1) saturate(1.3) brightness(0.95)',
    thumbnail: 'linear-gradient(135deg, #1a237e 0%, #4a148c 100%)',
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    filter: 'saturate(1.5) contrast(1.05) brightness(1.05)',
    thumbnail: 'linear-gradient(135deg, #e91e63 0%, #ff5722 100%)',
  },
  {
    id: 'vintage',
    name: 'Vintage',
    filter: 'sepia(0.3) contrast(1.1) brightness(0.95) saturate(0.85)',
    thumbnail: 'linear-gradient(135deg, #795548 0%, #a1887f 100%)',
  },
  {
    id: 'retro',
    name: 'Retro',
    filter: 'sepia(0.2) saturate(1.2) hue-rotate(-10deg) contrast(1.05)',
    thumbnail: 'linear-gradient(135deg, #ff6f00 0%, #f9a825 100%)',
  },
  {
    id: 'cool',
    name: 'Cool',
    filter: 'saturate(0.9) hue-rotate(10deg) brightness(1.05)',
    thumbnail: 'linear-gradient(135deg, #00bcd4 0%, #3f51b5 100%)',
  },
  {
    id: 'warm',
    name: 'Warm',
    filter: 'saturate(1.1) hue-rotate(-10deg) brightness(1.05) sepia(0.1)',
    thumbnail: 'linear-gradient(135deg, #ff7043 0%, #ffc107 100%)',
  },
  {
    id: 'moody',
    name: 'Moody',
    filter: 'contrast(1.2) brightness(0.85) saturate(0.8)',
    thumbnail: 'linear-gradient(135deg, #263238 0%, #455a64 100%)',
  },
  {
    id: 'bright',
    name: 'Bright',
    filter: 'brightness(1.15) contrast(0.95) saturate(1.1)',
    thumbnail: 'linear-gradient(135deg, #fff59d 0%, #fff9c4 100%)',
  },
  {
    id: 'bw',
    name: 'B&W',
    filter: 'grayscale(1) contrast(1.1)',
    thumbnail: 'linear-gradient(135deg, #424242 0%, #9e9e9e 100%)',
  },
  {
    id: 'fade',
    name: 'Fade',
    filter: 'contrast(0.85) brightness(1.1) saturate(0.8)',
    thumbnail: 'linear-gradient(135deg, #b0bec5 0%, #eceff1 100%)',
  },
  {
    id: 'drama',
    name: 'Drama',
    filter: 'contrast(1.3) saturate(1.2) brightness(0.9)',
    thumbnail: 'linear-gradient(135deg, #1b1b1b 0%, #880e4f 100%)',
  },
];

export function getFilterById(id: string): FilterPreset | undefined {
  return filterPresets.find(f => f.id === id);
}

export function getDefaultFilter(): FilterPreset {
  return filterPresets[0];
}
