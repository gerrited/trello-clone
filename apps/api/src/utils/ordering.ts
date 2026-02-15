import { generateKeyBetween } from 'fractional-indexing';

/**
 * Generate a position key for inserting an item at the end of a list.
 * @param lastPosition - The position of the current last item, or null if list is empty.
 */
export function getPositionAfter(lastPosition: string | null): string {
  return generateKeyBetween(lastPosition, null);
}

/**
 * Generate a position key for inserting an item before the first item.
 * @param firstPosition - The position of the current first item, or null if list is empty.
 */
export function getPositionBefore(firstPosition: string | null): string {
  return generateKeyBetween(null, firstPosition);
}

/**
 * Generate a position key between two adjacent items.
 * @param before - Position of the item before, or null for start of list.
 * @param after - Position of the item after, or null for end of list.
 */
export function getPositionBetween(before: string | null, after: string | null): string {
  return generateKeyBetween(before, after);
}
