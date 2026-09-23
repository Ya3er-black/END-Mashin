/**
 * ماژول مدیریت ناوبری و انتقال سریع به بخش‌های تعاریف سیستم
 */

export type QuickEntityType =
  | 'vehicle'
  | 'driver'
  | 'supplier'
  | 'mechanic'
  | 'company'
  | 'service'
  | 'failure'
  | 'part';

export interface EntityDefinitionTarget {
  view: string;
  title: string;
  addNewButtonLabel: string;
}

export const ENTITY_DEFINITION_TARGETS: Record<QuickEntityType, EntityDefinitionTarget> = {
  vehicle: {
    view: 'vehicles',
    title: 'ناوگان و خودروها',
    addNewButtonLabel: 'افزودن خودرو جدید...'
  },
  driver: {
    view: 'persons',
    title: 'پرسنل و رانندگان',
    addNewButtonLabel: 'افزودن راننده / پرسنل جدید...'
  },
  supplier: {
    view: 'suppliers',
    title: 'تامین‌کنندگان',
    addNewButtonLabel: 'افزودن تامین‌کننده جدید...'
  },
  mechanic: {
    view: 'mechanics',
    title: 'تعمیرکاران و مراکز خدمات',
    addNewButtonLabel: 'افزودن تعمیرکار جدید...'
  },
  company: {
    view: 'companies',
    title: 'شرکت‌ها و شعب',
    addNewButtonLabel: 'افزودن شرکت جدید...'
  },
  service: {
    view: 'service_definitions',
    title: 'تعاریف خدمات و سرویس‌ها',
    addNewButtonLabel: 'افزودن خدمت جدید...'
  },
  failure: {
    view: 'failure_definitions',
    title: 'تعاریف انواع و دسته‌های خرابی',
    addNewButtonLabel: 'تعریف نوع خرابی جدید...'
  },
  part: {
    view: 'parts',
    title: 'انبار و قطعات',
    addNewButtonLabel: 'افزودن قطعه جدید به انبار...'
  }
};

let currentActiveView = 'dashboard';
let originViewStack: Array<{ fromView: string; entityType: QuickEntityType }> = [];

export function setCurrentActiveView(view: string) {
  currentActiveView = view;
}

export function getCurrentActiveView(): string {
  return currentActiveView;
}

export function pushNavigationOrigin(fromView: string, entityType: QuickEntityType) {
  originViewStack.push({ fromView, entityType });
}

export function popNavigationOrigin(): { fromView: string; entityType: QuickEntityType } | null {
  return originViewStack.pop() || null;
}

export function peekNavigationOrigin(): { fromView: string; entityType: QuickEntityType } | null {
  return originViewStack.length > 0 ? originViewStack[originViewStack.length - 1] : null;
}

export function clearNavigationHistory() {
  originViewStack = [];
}

/**
 * بازگشت به بخش قبلی که کاربر از آنجا آمده است
 */
export function returnToOriginView(): boolean {
  const lastOrigin = popNavigationOrigin();
  if (lastOrigin && lastOrigin.fromView) {
    window.dispatchEvent(
      new CustomEvent('app:navigate-view', {
        detail: {
          view: lastOrigin.fromView,
          isReturn: true,
          entityType: lastOrigin.entityType
        }
      })
    );
    return true;
  }
  return false;
}

export type EntityCreatedCallback = (item: any) => void;

let currentCallback: EntityCreatedCallback | null = null;

/**
 * باز کردن فرم تعریف بدون انتقال تب و بدون unmount شدن صفحه جاری
 */
export function openQuickEntityModal(
  entityType: QuickEntityType,
  onCreated?: EntityCreatedCallback
) {
  currentCallback = onCreated || null;
  window.dispatchEvent(
    new CustomEvent('app:open-quick-entity-modal', {
      detail: { entityType }
    })
  );
}

/**
 * اعلان ثبت موفقیت‌آمیز یک آیتم تعریف به فراخواننده (مانند دراپ‌داون در حال انتخاب)
 */
export function notifyEntityCreated(item: any) {
  if (currentCallback) {
    try {
      currentCallback(item);
    } catch (e) {
      console.error(e);
    }
    currentCallback = null;
  }
}

/**
 * انتقال مستقیم به بخش تعاریف مربوطه و باز کردن فرم افزودن
 */
export function navigateToEntityDefinition(
  entityType: QuickEntityType,
  options?: { openForm?: boolean }
) {
  const target = ENTITY_DEFINITION_TARGETS[entityType];
  if (!target) return;

  const fromView = currentActiveView;
  // اگر ویوی مقصد با ویوی فعلی متفاوت باشد، به عنوان مبدا ثبت کن
  if (fromView && fromView !== target.view) {
    pushNavigationOrigin(fromView, entityType);
  }

  // ۱. انتشار رویداد سراسری تغییر تب/ویو
  window.dispatchEvent(
    new CustomEvent('app:navigate-view', {
      detail: {
        view: target.view,
        entityType,
        fromView,
        openForm: options?.openForm ?? true
      }
    })
  );

  // ۲. ارسال پیام باز شدن فرم ایجاد در کامپوننت مقصد پس از سوئیچ تب
  setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent('app:open-create-form', {
        detail: {
          entityType,
          view: target.view,
          fromView
        }
      })
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 100);
}

