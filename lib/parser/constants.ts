// Parser constants

export const SCENE_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
]

// Keyword aliases - allows alternative keywords to avoid conflicts
export const KEYWORD_ALIASES: Record<string, string> = {
  // Scene aliases
  'slide': 'scene',
  'frame': 'scene',
  'section': 'scene',
  'page': 'scene',

  // Text aliases
  'heading': 'text',
  'title': 'text',
  'h1': 'text',
  'h2': 'text',
  'h3': 'text',
  'paragraph': 'text',
  'p': 'text',

  // Code aliases
  'snippet': 'code',
  'block': 'code',
  'codeblock': 'code',
  'syntax': 'code',

  // Terminal aliases
  'shell': 'terminal',
  'cli': 'terminal',
  'console': 'terminal',
  'cmd': 'terminal',
  'bash': 'terminal',

  // Chart aliases
  'graph': 'chart',
  'plot': 'chart',
  'data': 'chart',

  // Mockup aliases
  'device': 'mockup',
  'screen': 'mockup',
  'preview': 'mockup',

  // Image aliases
  'img': 'image',
  'photo': 'image',
  'picture': 'image',

  // Layout/Split aliases
  'split': 'layout',
  'two-column': 'layout',
  'columns': 'layout',

  // Duration aliases
  'time': 'duration',
  'length': 'duration',
  'dur': 'duration',

  // Background aliases
  'bg': 'background',
  'color': 'background',
  'fill': 'background',

  // Transition aliases
  'trans': 'transition',
  'effect': 'transition',
  'animation': 'transition',

  // Chapter aliases
  'section-title': 'chapter',
  'heading-title': 'chapter',
  'section-heading': 'chapter',

  // Particles aliases
  'effects': 'particles',
  'fx': 'particles',
  'sparkles': 'particles',

  // Camera aliases
  'zoom': 'camera',
  'pan': 'camera',
  'move': 'camera',

  // Presenter aliases
  'avatar': 'presenter',
  'person': 'presenter',
  'speaker': 'presenter',

  // Callout aliases
  'note': 'callout',
  'tip': 'callout',
  'info': 'callout',
  'annotation': 'callout',

  // Variable aliases
  'variable': 'var',
  'v': 'var',
  'const': 'var',
}

export const SCENE_DIRECTIVES = ['scene', 'slide', 'frame', 'section', 'page'] as const
