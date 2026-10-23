/**
 * Friend codes are six picture ids chosen from sixteen icons.
 * Children enter them by tapping pictures. No keyboard, no display string on the wire.
 */
export const FRIEND_CODE_ICONS = [
  { id: 0, name: 'Bean' },
  { id: 1, name: 'Star' },
  { id: 2, name: 'Moon' },
  { id: 3, name: 'Heart' },
  { id: 4, name: 'Sun' },
  { id: 5, name: 'Cloud' },
  { id: 6, name: 'Leaf' },
  { id: 7, name: 'Fish' },
  { id: 8, name: 'Apple' },
  { id: 9, name: 'Ball' },
  { id: 10, name: 'Hat' },
  { id: 11, name: 'Boot' },
  { id: 12, name: 'Cake' },
  { id: 13, name: 'Tree' },
  { id: 14, name: 'Bell' },
  { id: 15, name: 'Kite' },
] as const

export const FRIEND_CODE_ICON_COUNT = FRIEND_CODE_ICONS.length
export const FRIEND_CODE_LENGTH = 6

export function isPictureFriendCode(symbols: readonly number[]): boolean {
  return (
    symbols.length === FRIEND_CODE_LENGTH &&
    symbols.every((symbol) => Number.isInteger(symbol) && symbol >= 0 && symbol < FRIEND_CODE_ICON_COUNT)
  )
}
