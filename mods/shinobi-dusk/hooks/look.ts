// The look set once per session: the Desktop colors and the backdrop scene.

import type { ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

export const SCENE_NAME = 'shinobi-dusk'

// Plum-black surfaces from the dusk sky, an ember-orange accent. Dark only: it's dusk.
const { theme, problems } = makeColors({
  label: 'Shinobi dusk',
  only: 'dark',
  roles: { accent: '#ff8a1f', danger: '#d9443a', success: '#6fae5a', warning: '#e8a23a', pro: '#8a6fd1' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0f0b14',
        'surface-1': '#15101b',
        'surface-2': '#1b1522',
        'surface-3': '#211a29',
        'text-primary': '#f2e9e1',
        'text-secondary': '#cdc1b8',
        'text-muted': '#a3978f',
      },
    },
  },
})

export const PROBLEMS = problems

// The one kind of color problem that stops Desktop painting the theme at all.
export const UNPAINTABLE = problems.find(line => line.startsWith("Desktop won't paint"))

export const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: SCENE_NAME, glass: { blur: 18, tint: '#0f0b14', opacity: 0.6 } },
  overrideColorScheme: 'dark',
}
