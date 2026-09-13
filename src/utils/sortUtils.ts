/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SortDirection = 'asc' | 'desc';

export interface SortConfig<T> {
  key: keyof T | string;
  direction: SortDirection;
}

export function sortData<T>(
  data: T[],
  sortKey: string,
  sortDirection: SortDirection,
  customExtractors?: Record<string, (item: T) => any>
): T[] {
  if (!sortKey) return data;

  return [...data].sort((a: any, b: any) => {
    let aValue: any;
    let bValue: any;

    if (customExtractors && customExtractors[sortKey]) {
      aValue = customExtractors[sortKey](a);
      bValue = customExtractors[sortKey](b);
    } else if (sortKey in a) {
      aValue = a[sortKey];
      bValue = b[sortKey];
    } else {
      aValue = '';
      bValue = '';
    }

    if (aValue === null || aValue === undefined) aValue = '';
    if (bValue === null || bValue === undefined) bValue = '';

    // If numbers
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    // If string representing numbers (e.g. Persian/Latin digits or strings)
    const aNum = Number(String(aValue).replace(/[^\d.-]/g, ''));
    const bNum = Number(String(bValue).replace(/[^\d.-]/g, ''));
    if (!isNaN(aNum) && !isNaN(bNum) && String(aValue).trim() !== '' && String(bValue).trim() !== '' && !isNaN(Number(aValue)) && !isNaN(Number(bValue))) {
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }

    // String comparison (supports Persian locale)
    const aStr = String(aValue);
    const bStr = String(bValue);

    const comp = aStr.localeCompare(bStr, 'fa');
    return sortDirection === 'asc' ? comp : -comp;
  });
}
