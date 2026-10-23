/** Team identity is colour plus shape plus pattern (doc 04 §6, doc 05). Hue is never the only channel. */
export const TEAM_MARKS = [
  { id: 'a', colour: '#FF6B5B', shape: 'triangle', pattern: 'stripe' },
  { id: 'b', colour: '#2D7DD2', shape: 'circle', pattern: 'dot' },
  { id: 'c', colour: '#3DBB6B', shape: 'square', pattern: 'wave' },
  { id: 'd', colour: '#F4C430', shape: 'star', pattern: 'cross' },
] as const
