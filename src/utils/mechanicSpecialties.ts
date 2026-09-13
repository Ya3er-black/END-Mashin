export const DEFAULT_MECHANIC_SPECIALTIES: string[] = [
  'مکانیک موتور و گیربکس',
  'برق و الکترونیک خودرو',
  'جلوبندی و سیستم تعلیق',
  'صافکاری و نقاشی',
  'تخصصی هیدرولیک و فرمان',
  'سرویس‌های دوره‌ای و تعویض روغنی'
];

const STORAGE_KEY = 'fleet_mechanic_specialties';
const EVENT_KEY = 'fleet_mechanic_specialties_changed';

export function getStoredMechanicSpecialties(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load mechanic specialties from storage', e);
  }
  return [...DEFAULT_MECHANIC_SPECIALTIES];
}

export function addStoredMechanicSpecialty(specialtyName: string): string[] {
  const trimmed = specialtyName.trim();
  if (!trimmed) return getStoredMechanicSpecialties();
  
  const current = getStoredMechanicSpecialties();
  if (current.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
    return current;
  }
  
  const updated = [...current, trimmed];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: { updated } }));
  } catch (e) {
    console.error('Failed to save mechanic specialty to storage', e);
  }
  return updated;
}

export function subscribeMechanicSpecialties(callback: (list: string[]) => void): () => void {
  const handler = () => {
    callback(getStoredMechanicSpecialties());
  };
  window.addEventListener(EVENT_KEY, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT_KEY, handler);
    window.removeEventListener('storage', handler);
  };
}
