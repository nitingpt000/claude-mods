// The look set once per session: the Desktop colors and the backdrop scene.

import type { ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

export const SCENE_NAME = 'wisteria-moon'

// Indigo-night surfaces from the sky, a wisteria-violet accent. Dark only: it's night.
const { theme, problems } = makeColors({
  label: 'Wisteria Moon',
  only: 'dark',
  roles: { accent: '#b294ea', danger: '#e0505a', success: '#6fbf8a', warning: '#e8a85a', pro: '#8aa4ff' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0b0d1c',
        'surface-1': '#10132a',
        'surface-2': '#151933',
        'surface-3': '#1a1e3b',
        'text-primary': '#eeeaf8',
        'text-secondary': '#c8c2dc',
        'text-muted': '#a19bb8',
      },
    },
  },
})

export const PROBLEMS = problems

// The one kind of color problem that stops Desktop painting the theme at all.
export const UNPAINTABLE = problems.find(line => line.startsWith("Desktop won't paint"))

export const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: SCENE_NAME, glass: { blur: 18, tint: '#0b0d1c', opacity: 0.6 } },
  overrideColorScheme: 'dark',
}
