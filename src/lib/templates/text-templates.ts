import { TextStyleTemplate } from '@/types/overlays';

/**
 * Text style templates for text overlays
 * 8 curated styles for short-form video content
 */
export const textStyleTemplates: TextStyleTemplate[] = [
  {
    id: 'bold-white',
    name: 'Bold White',
    fontFamily: 'Inter, sans-serif',
    fontSize: '48px',
    fontWeight: 700,
    color: '#FFFFFF',
    textShadow: '2px 2px 8px rgba(0,0,0,0.8)',
    padding: '8px 16px',
  },
  {
    id: 'neon-glow',
    name: 'Neon Glow',
    fontFamily: 'Outfit, sans-serif',
    fontSize: '44px',
    fontWeight: 600,
    color: '#FF00FF',
    textShadow: '0 0 10px #FF00FF, 0 0 20px #FF00FF, 0 0 40px #FF00FF',
    padding: '8px 16px',
  },
  {
    id: 'boxed',
    name: 'Boxed',
    fontFamily: 'Inter, sans-serif',
    fontSize: '40px',
    fontWeight: 600,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: '8px',
    padding: '12px 20px',
  },
  {
    id: 'highlight',
    name: 'Highlight',
    fontFamily: 'Inter, sans-serif',
    fontSize: '42px',
    fontWeight: 700,
    color: '#000000',
    backgroundColor: '#FFFF00',
    borderRadius: '4px',
    padding: '8px 16px',
  },
  {
    id: 'handwritten',
    name: 'Handwritten',
    fontFamily: 'Caveat, cursive',
    fontSize: '56px',
    fontWeight: 400,
    color: '#FFFFFF',
    textShadow: '2px 2px 6px rgba(0,0,0,0.7)',
    padding: '8px 16px',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    fontFamily: 'Inter, sans-serif',
    fontSize: '36px',
    fontWeight: 400,
    color: '#FFFFFF',
    textShadow: '1px 1px 4px rgba(0,0,0,0.5)',
    letterSpacing: '0.05em',
    padding: '8px 16px',
  },
  {
    id: 'gradient-box',
    name: 'Gradient Box',
    fontFamily: 'Inter, sans-serif',
    fontSize: '40px',
    fontWeight: 600,
    color: '#FFFFFF',
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '12px',
    padding: '12px 24px',
  },
  {
    id: 'retro',
    name: 'Retro',
    fontFamily: 'Outfit, sans-serif',
    fontSize: '44px',
    fontWeight: 700,
    color: '#FFC107',
    textShadow: '3px 3px 0 #FF5722, 6px 6px 0 rgba(0,0,0,0.3)',
    padding: '8px 16px',
  },
];

export function getTextStyleById(id: string): TextStyleTemplate | undefined {
  return textStyleTemplates.find(t => t.id === id);
}

export function getDefaultTextStyle(): TextStyleTemplate {
  return textStyleTemplates[0]; // Bold White as default
}
