// The look set once per session: the Desktop colors and the backdrop scene.

import type { ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

export const SCENE_NAME = 'grand-tide'

// Deep-sea navy surfaces, a sunset-gold accent. Dark only: it's dusk at sea.
const { theme, problems } = makeColors({
  label: 'Grand Tide',
  only: 'dark',
  roles: { accent: '#ffb347', danger: '#e0503a', success: '#5fb88a', warning: '#e8903a', pro: '#7f9cf0' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0c1428',
        'surface-1': '#111a31',
        'surface-2': '#16203a',
        'surface-3': '#1b2642',
        'text-primary': '#f4ede2',
        'text-secondary': '#cfc6b8',
        'text-muted': '#a69e92',
      },
    },
  },
})

export const PROBLEMS = problems

// The one kind of color problem that stops Desktop painting the theme at all.
export const UNPAINTABLE = problems.find(line => line.startsWith("Desktop won't paint"))

export const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: SCENE_NAME, glass: { blur: 18, tint: '#0c1428', opacity: 0.58 } },
  overrideColorScheme: 'dark',
}
