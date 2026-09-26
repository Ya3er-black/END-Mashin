import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, Car, User, Wrench, Building, Store, Settings, Package, 
  Check, AlertCircle, AlertTriangle, Plus 
} from 'lucide-react';
import { 
  QuickEntityType, 
  notifyEntityCreated 
} from '../utils/navigation';
import { Company, Person, ServiceDefinition, Mechanic, Supplier, FailureCategory } from '../types';
import { CustomSelect } from './CustomSelect';
import { formatNumber, parsePersianNumber, toPersianDigits, normalizePhone } from '../utils/numberUtils';
import { AddMechanicSpecialtyModal } from './AddMechanicSpecialtyModal';
import { getStoredMechanicSpecialties, subscribeMechanicSpecialties } from '../utils/mechanicSpecialties';

interface GlobalEntityDefinitionModalProps {
  isOpen: boolean;
  entityType: QuickEntityType | null;
  onClose: () => void;
  companies: Company[];
  persons: Person[];
  serviceDefinitions: ServiceDefinition[];
  mechanics?: Mechanic[];
  suppliers?: Supplier[];
  failureCategories?: FailureCategory[];
  onAddVehicle: (v: any) => Promise<any>;
  onAddPerson: (p: any) => Promise<any>;
  onAddSupplier: (s: any) => Promise<any>;
  onAddMechanic: (m: any) => Promise<any>;
  onAddCompany: (c: any) => Promise<any>;
  onAddServiceDefinition: (sd: any) => Promise<any>;
  onAddFailureDefinition?: (fd: any) => Promise<any>;
  onAddPart: (part: any) => Promise<any>;
}

const IRAN_PLATE_LETTERS = [
  'ب', 'الف', 'ج', 'د', 'ر', 'ز', 'س', 'ش', 'ص', 'ط', 'ع', 'ف', 'ق', 'ک', 'ل', 'م', 'ن', 'و', 'ه', 'ی', 'پ', 'ت', 'ژ', 'معلولین', 'تشریفات'
];

const MECHANIC_SPECIALTIES = [
  'مکانیک موتور و گیربکس',
  'برق و الکترونیک خودرو',
  'جلوبندی و سیستم تعلیق',
  'صافکاری و نقاشی',
  'تخصصی هیدرولیک و فرمان',
  'سرویس‌های دوره‌ای و تعویض روغنی'
];

export default function GlobalEntityDefinitionModal({
  isOpen,
  entityType,
  onClose,
  companies,
  persons,
  serviceDefinitions: _serviceDefinitions,
  mechanics = [],
  suppliers = [],
  failureCategories = [],
  onAddVehicle,
  onAddPerson,
  onAddSupplier,
  onAddMechanic,
  onAddCompany,
  onAddServiceDefinition,
  onAddFailureDefinition,
  onAddPart
}: GlobalEntityDefinitionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // فیلدهای تعریف خرابی (مطابق دقیق با FailureDefinitionsView.tsx)
  const [failType, setFailType] = useState('');
  const [failCat, setFailCat] = useState('');
  const [failDesc, setFailDesc] = useState('');

  // فیلدهای خودرو (مطابق دقیق با VehiclesView.tsx)
  const [vCode, setVCode] = useState('');
  const [vName, setVName] = useState('');
  const [vProductionYear, setVProductionYear] = useState<number | ''>('');
  const [vCurrentKm, setVCurrentKm] = useState<number | ''>('');
  const [vCompany, setVCompany] = useState('');
  const [vDriverName, setVDriverName] = useState('');
  const [vPlatePart1, setVPlatePart1] = useState('');
  const [vPlateLetter, setVPlateLetter] = useState('ب');
  const [vPlatePart2, setVPlatePart2] = useState('');
  const [vPlatePart3, setVPlatePart3] = useState('');

  // فیلدهای راننده / شخص (مطابق دقیق با PersonsView.tsx)
  const [pFullName, setPFullName] = useState('');
  const [pPhone, setPPhone] = useState('');

  // فیلدهای تأمین‌کننده (مطابق دقیق با SuppliersView.tsx)
  const [sName, setSName] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sAddress, setSAddress] = useState('');

  // فیلدهای تعمیرکار (مطابق دقیق با MechanicsView.tsx)
  const [mName, setMName] = useState('');
  const [mPhone, setMPhone] = useState('');
  const [mSpecialty, setMSpecialty] = useState('مکانیک موتور و گیربکس');
  const [mShopName, setMShopName] = useState('');
  const [mechanicSpecialties, setMechanicSpecialties] = useState<string[]>(() => getStoredMechanicSpecialties());
  const [isAddSpecialtyModalOpen, setIsAddSpecialtyModalOpen] = useState(false);

  useEffect(() => {
    return subscribeMechanicSpecialties((updated) => {
      setMechanicSpecialties(updated);
    });
  }, []);

  // فیلدهای شرکت (مطابق دقیق با CompaniesView.tsx)
  const [cName, setCName] = useState('');
  const [cStatus, setCStatus] = useState<'active' | 'inactive'>('active');
  const [cAddress, setCAddress] = useState('');

  // فیلدهای خدمت دوره‌ای (مطابق دقیق با ServiceDefinitionsView.tsx)
  const [sdTitle, setSdTitle] = useState('');
  const [sdIntervalKm, setSdIntervalKm] = useState<number | ''>(5000);
  const [sdWarningKm, setSdWarningKm] = useState<number | ''>(200);

  // فیلدهای قطعه انبار (مطابق دقیق با PartFormModal در InventoryModals.tsx)
  const [partName, setPartName] = useState('');
  const [partBuyPrice, setPartBuyPrice] = useState<number | ''>('');
  const [partSellPrice, setPartSellPrice] = useState<number | ''>('');
  const [partMinQty, setPartMinQty] = useState<number | ''>(5);
  const [partLocation, setPartLocation] = useState('');
  const submittedPhoneRef = useRef<string | null>(null);

  // زیرمدال‌های ثبت سریع شرکت و راننده در فرم تعریف خودرو
  const [isAddCompanySubModalOpen, setIsAddCompanySubModalOpen] = useState(false);
  const [subCompanyName, setSubCompanyName] = useState('');
  const [subCompanyStatus, setSubCompanyStatus] = useState<'active' | 'inactive'>('active');
  const [subCompanyAddress, setSubCompanyAddress] = useState('');
  const [isSubmittingSubCompany, setIsSubmittingSubCompany] = useState(false);
  const [subCompanyError, setSubCompanyError] = useState('');

  const [isAddDriverSubModalOpen, setIsAddDriverSubModalOpen] = useState(false);
  const [subDriverFullName, setSubDriverFullName] = useState('');
  const [subDriverPhone, setSubDriverPhone] = useState('');
  const [isSubmittingSubDriver, setIsSubmittingSubDriver] = useState(false);
  const [subDriverError, setSubDriverError] = useState('');

  const duplicateSubDriver = useMemo(() => {
    if (isSubmittingSubDriver) return null;
    const norm = normalizePhone(subDriverPhone);
    if (!norm || norm.length < 7) return null;
    return persons.find(p => normalizePhone(p.phone) === norm) || null;
  }, [subDriverPhone, persons, isSubmittingSubDriver]);

  const handleSaveSubCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubCompanyError('');
    if (!subCompanyName.trim()) {
      setSubCompanyError('لطفاً نام شرکت / سازمان را وارد کنید.');
      return;
    }
    setIsSubmittingSubCompany(true);
    try {
      await onAddCompany({
        name: subCompanyName.trim(),
        status: subCompanyStatus,
        address: subCompanyAddress.trim()
      });
      setVCompany(subCompanyName.trim());
      setIsAddCompanySubModalOpen(false);
    } catch (err: any) {
      setSubCompanyError(err?.message || 'خطا در ثبت شرکت');
    } finally {
      setIsSubmittingSubCompany(false);
    }
  };

  const handleSaveSubDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubDriverError('');
    if (!subDriverFullName.trim()) {
      setSubDriverError('لطفاً نام و نام خانوادگی راننده را وارد کنید.');
      return;
    }
    if (duplicateSubDriver) {
      setSubDriverError(`این شماره تماس قبلاً برای «${duplicateSubDriver.fullName}» ثبت شده است.`);
      return;
    }
    setIsSubmittingSubDriver(true);
    try {
      await onAddPerson({
        fullName: subDriverFullName.trim(),
        phone: subDriverPhone.trim()
      });
      setVDriverName(subDriverFullName.trim());
      setIsAddDriverSubModalOpen(false);
    } catch (err: any) {
      setSubDriverError(err?.message || 'خطا در ثبت راننده');
    } finally {
      setIsSubmittingSubDriver(false);
    }
  };

  // بررسی شماره تلفن تکراری در رانندگان (منحصراً در بخش رانندگان و پرسنل)
  const duplicatePerson = useMemo(() => {
    if (isSubmitting) return null;
    if (entityType !== 'driver') return null;
    const normCurrent = normalizePhone(pPhone);
    if (!normCurrent || normCurrent.length < 7) return null;
    if (submittedPhoneRef.current && submittedPhoneRef.current === normCurrent) return null;
    return persons.find(p => normalizePhone(p.phone) === normCurrent) || null;
  }, [entityType, pPhone, persons, isSubmitting]);

  // بررسی شماره تلفن تکراری در تعمیرکاران (منحصراً در بخش تعمیرکاران)
  const duplicateMechanic = useMemo(() => {
    if (isSubmitting) return null;
    if (entityType !== 'mechanic') return null;
    const normCurrent = normalizePhone(mPhone);
    if (!normCurrent || normCurrent.length < 7) return null;
    if (submittedPhoneRef.current && submittedPhoneRef.current === normCurrent) return null;
    return (mechanics || []).find(m => normalizePhone(m.phone) === normCurrent) || null;
  }, [entityType, mPhone, mechanics, isSubmitting]);

  // بررسی شماره تلفن تکراری در تامین‌کنندگان (منحصراً در بخش تامین‌کنندگان)
  const duplicateSupplier = useMemo(() => {
    if (isSubmitting) return null;
    if (entityType !== 'supplier') return null;
    const normCurrent = normalizePhone(sPhone);
    if (!normCurrent || normCurrent.length < 7) return null;
    if (submittedPhoneRef.current && submittedPhoneRef.current === normCurrent) return null;
    return (suppliers || []).find(s => normalizePhone(s.phone || s.mobile) === normCurrent) || null;
  }, [entityType, sPhone, suppliers, isSubmitting]);

  // ریست فرم در زمان باز شدن
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setIsSubmitting(false);
      submittedPhoneRef.current = null;

      // خودرو
      setVCode(`VEH-${Math.floor(100 + Math.random() * 900)}`);
      setVName('');
      setVProductionYear('');
      setVCurrentKm('');
      setVCompany('');
      setVDriverName('');
      setVPlatePart1('');
      setVPlateLetter('ب');
      setVPlatePart2('');
      setVPlatePart3('');

      // راننده
      setPFullName('');
      setPPhone('');

      // تامین‌کننده
      setSName('');
      setSPhone('');
      setSAddress('');

      // تعمیرکار
      setMName('');
      setMPhone('');
      setMSpecialty('مکانیک موتور و گیربکس');
      setMShopName('');

      // شرکت
      setCName('');
      setCStatus('active');
      setCAddress('');

      // خدمت
      setSdTitle('');
      setSdIntervalKm(5000);
      setSdWarningKm(200);

      // قطعه
      setPartName('');
      setPartBuyPrice('');
      setPartSellPrice('');
      setPartMinQty(5);
      setPartLocation('');

      // تعریف خرابی
      setFailType('');
      setFailCat(failureCategories && failureCategories.length > 0 ? failureCategories[0].name : 'عمومی');
      setFailDesc('');
    }
  }, [isOpen, entityType]);

  if (!isOpen || !entityType) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      let createdResult: any = null;

      if (entityType === 'vehicle') {
        if (!vCode.trim() || !vName.trim()) {
          throw new Error('لطفاً فیلدهای الزامی (کد و نام خودرو) را وارد کنید.');
        }
        const hasPlateParts = vPlatePart1.trim() || vPlatePart2.trim() || vPlatePart3.trim();
        let plaque = '';
        if (hasPlateParts) {
          if (!vPlatePart1.trim() || !vPlatePart2.trim() || !vPlatePart3.trim()) {
            throw new Error('لطفاً شماره پلاک را به صورت کامل تکمیل کنید.');
          }
          plaque = `${toPersianDigits(vPlatePart1.trim())} ${vPlateLetter} ${toPersianDigits(vPlatePart2.trim())} ایران ${toPersianDigits(vPlatePart3.trim())}`;
        }
        const matchedPerson = persons.find(p => p.fullName === vDriverName.trim());
        const resolvedPhone = matchedPerson?.phone || '-';

        const newVehicle = {
          code: vCode.trim(),
          name: vName.trim(),
          brand: '-',
          model: '-',
          productionYear: vProductionYear ? Number(vProductionYear) : 1402,
          currentKm: vCurrentKm ? Number(vCurrentKm) : 0,
          plaque: plaque,
          plate: plaque,
          chassisNumber: '-',
          engineNumber: '-',
          vin: '-',
          company: vCompany.trim() || '-',
          project: '-',
          department: 'ترابری',
          location: '-',
          driverName: vDriverName.trim() || 'ثبت نشده',
          driverPhone: resolvedPhone,
          color: '-',
          status: 'active' as const,
          qrCode: `${vCode.trim()}_${vName.trim()}_${plaque}`.replace(/\s+/g, '_')
        };
        createdResult = await onAddVehicle(newVehicle);

      } else if (entityType === 'driver') {
        if (!pFullName.trim()) {
          throw new Error('لطفاً نام راننده را وارد کنید.');
        }
        if (duplicatePerson) {
          throw new Error(`این شماره تماس قبلاً برای «${duplicatePerson.fullName}» در بخش رانندگان ثبت شده است.`);
        }

        submittedPhoneRef.current = normalizePhone(pPhone.trim());
        const newPerson = {
          fullName: pFullName.trim(),
          position: 'راننده ناوگان',
          phone: pPhone.trim(),
          nationalCode: '',
          status: 'active' as const
        };
        createdResult = await onAddPerson(newPerson);

      } else if (entityType === 'supplier') {
        if (!sName.trim() || !sPhone.trim()) {
          throw new Error('لطفاً فیلدهای الزامی (نام تامین‌کننده و شماره تماس) را پر کنید.');
        }
        if (duplicateSupplier) {
          throw new Error(`این شماره تماس قبلاً برای تامین‌کننده «${duplicateSupplier.name}» در بخش تامین‌کنندگان ثبت شده است.`);
        }

        submittedPhoneRef.current = normalizePhone(sPhone.trim());
        const newSupplier = {
          name: sName.trim(),
          phone: sPhone.trim(),
          address: sAddress.trim() || undefined,
          status: 'active' as const
        };
        createdResult = await onAddSupplier(newSupplier);

      } else if (entityType === 'mechanic') {
        if (!mName.trim() || !mPhone.trim() || !mShopName.trim()) {
          throw new Error('لطفاً نام، شماره تماس و آدرس تعمیرکار را تکمیل کنید.');
        }
        if (duplicateMechanic) {
          throw new Error(`این شماره تماس قبلاً برای تعمیرکار «${duplicateMechanic.name}» در بخش تعمیرکاران ثبت شده است.`);
        }

        submittedPhoneRef.current = normalizePhone(mPhone.trim());
        const newMechanic = {
          name: mName.trim(),
          phone: mPhone.trim(),
          specialty: mSpecialty,
          shopName: mShopName.trim(),
          address: mShopName.trim(),
          status: 'active' as const
        };
        createdResult = await onAddMechanic(newMechanic);

      } else if (entityType === 'company') {
        if (!cName.trim()) {
          throw new Error('لطفاً نام شرکت را وارد کنید.');
        }

        const generatedCode = `COMP-${Math.floor(100 + Math.random() * 900)}`;
        const newCompany = {
          name: cName.trim(),
          code: generatedCode,
          managerName: '-',
          phone: '-',
          address: cAddress.trim(),
          status: cStatus
        };
        createdResult = await onAddCompany(newCompany);

      } else if (entityType === 'service') {
        if (!sdTitle.trim() || !sdIntervalKm || !sdWarningKm) {
          throw new Error('لطفاً عنوان خدمت، دوره تعویض و بازه اخطار را تکمیل کنید.');
        }

        const newServiceDef = {
          serviceType: sdTitle.trim(),
          intervalKm: Number(sdIntervalKm),
          warningKm: Number(sdWarningKm)
        };
        createdResult = await onAddServiceDefinition(newServiceDef);

      } else if (entityType === 'part') {
        if (!partName.trim()) {
          throw new Error('لطفاً نام قطعه / کالا را وارد کنید.');
        }

        const bPrice = partBuyPrice ? Number(partBuyPrice) : 0;
        const sPrice = partSellPrice ? Number(partSellPrice) : Math.round(bPrice * 1.25);
        const newPart = {
          partName: partName.trim(),
          partNumber: `PRT-${Math.floor(1000 + Math.random() * 9000)}`,
          quantity: 0,
          minQuantity: partMinQty ? Number(partMinQty) : 5,
          unitPrice: bPrice,
          buyPrice: bPrice,
          sellPrice: sPrice,
          warehouseLocation: partLocation.trim()
        };
        createdResult = await onAddPart(newPart);

      } else if (entityType === 'failure') {
        if (!failType.trim()) {
          throw new Error('لطفاً نوع خرابی / عنوان عیب را وارد کنید.');
        }

        const newDef = {
          failureType: failType.trim(),
          category: failCat.trim() || 'عمومی',
          description: failDesc.trim()
        };

        if (onAddFailureDefinition) {
          createdResult = await onAddFailureDefinition(newDef);
        }
      }

      // انتخاب اتوماتیک در فرم مبدا و بستن دیالوگ
      if (createdResult) {
        notifyEntityCreated(createdResult);
      }
      onClose();
    } catch (err: any) {
      submittedPhoneRef.current = null;
      setErrorMsg(err.message || 'خطا در ثبت اطلاعات.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEntityIcon = () => {
    switch (entityType) {
      case 'vehicle': return <Car className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'driver': return <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'supplier': return <Store className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'mechanic': return <Wrench className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'company': return <Building className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'service': return <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'failure': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'part': return <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      default: return <Car className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
    }
  };

  const getEntityTitle = () => {
    switch (entityType) {
      case 'vehicle': return 'ثبت و تعریف خودرو جدید';
      case 'driver': return 'ثبت و تعریف راننده جدید';
      case 'supplier': return 'ثبت تامین‌کننده و فروشگاه جدید';
      case 'mechanic': return 'ثبت تعمیرکار و مرکز خدمات جدید';
      case 'company': return 'ثبت شرکت / سازمان جدید';
      case 'service': return 'تعریف خدمت دوره‌ای جدید';
      case 'failure': return 'تعریف نوع خرابی جدید';
      case 'part': return 'تعریف قطعه و کالای جدید در انبار';
      default: return 'تعریف مورد جدید';
    }
  };

  const getEntitySubtitle = () => {
    switch (entityType) {
      case 'vehicle': return 'مدیریت ناوگان، پلاک، تخصیص شرکت و راننده';
      case 'driver': return 'مدیریت لیست رانندگان با نام و شماره تماس';
      case 'supplier': return 'ثبت مشخصات تامین‌کننده، آدرس و شماره تماس';
      case 'mechanic': return 'ثبت مشخصات تعمیرکار، آدرس، تخصص اصلی و شماره تماس';
      case 'company': return 'ثبت، ویرایش و مدیریت شرکت‌ها و سازمان‌های همکار';
      case 'service': return 'عنوان خدمت، دوره تعویض بر حسب کیلومتر و بازه هشدار';
      case 'failure': return 'ثبت مشخصات عیب، دسته‌بندی فنی و توضیحات مربوطه';
      case 'part': return 'مشخصات کالا، قیمت‌های خرید و فروش و موقعیت انبار';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto" dir="rtl">
      <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto">
        
        {/* هدر مدال */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-[#202024] rounded-lg border border-slate-200 dark:border-[#303035] shadow-xs">
              {getEntityIcon()}
            </div>
            <div>
              <h3 className="text-slate-900 dark:text-white text-sm font-bold">
                {getEntityTitle()}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {getEntitySubtitle()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* بدنه فرم */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs bg-white dark:bg-[#111113]">
          
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ۱. خودرو (دقیقاً فیلدهای VehiclesView.tsx) */}
          {entityType === 'vehicle' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* کد خودرو */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    کد خودرو <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="مثال: VEH-101" 
                    value={vCode} 
                    onChange={e => setVCode(e.target.value)} 
                    className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* نام کامل خودرو */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    نام خودرو <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="مثال: پژو پارس TU5" 
                    value={vName} 
                    onChange={e => setVName(e.target.value)} 
                    className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* سال ساخت */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 block">
                    سال ساخت (شمسی)
                  </label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={vProductionYear ? toPersianDigits(vProductionYear) : ''} 
                    onChange={e => setVProductionYear(parsePersianNumber(e.target.value))} 
                    placeholder="مثال: ۱۴۰۲"
                    className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* کیلومتر کارکرد فعلی */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    کیلومتر کارکرد فعلی (کیلومتر)
                  </label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={vCurrentKm ? formatNumber(vCurrentKm) : ''} 
                    onChange={e => setVCurrentKm(parsePersianNumber(e.target.value))} 
                    placeholder="مثال: ۱۲۰,۰۰۰"
                    className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* شرکت منتسب */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block">
                      شرکت منتسب
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setSubCompanyName('');
                        setSubCompanyStatus('active');
                        setSubCompanyAddress('');
                        setSubCompanyError('');
                        setIsAddCompanySubModalOpen(true);
                      }}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن شرکت جدید</span>
                    </button>
                  </div>
                  <CustomSelect
                    value={vCompany}
                    onChange={(val) => setVCompany(val)}
                    searchable={true}
                    onAddNew={() => {
                      setSubCompanyName('');
                      setSubCompanyStatus('active');
                      setSubCompanyAddress('');
                      setSubCompanyError('');
                      setIsAddCompanySubModalOpen(true);
                    }}
                    addNewLabel="افزودن شرکت جدید..."
                    placeholder="انتخاب شرکت..."
                    options={[
                      { value: '', label: 'بدون شرکت' },
                      ...companies.map(c => ({ value: c.name, label: c.name }))
                    ]}
                  />
                </div>

                {/* راننده منتسب */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block">
                      راننده منتسب
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setSubDriverFullName('');
                        setSubDriverPhone('');
                        setSubDriverError('');
                        setIsAddDriverSubModalOpen(true);
                      }}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن راننده جدید</span>
                    </button>
                  </div>
                  <CustomSelect
                    value={vDriverName}
                    onChange={(val) => setVDriverName(val)}
                    searchable={true}
                    onAddNew={() => {
                      setSubDriverFullName('');
                      setSubDriverPhone('');
                      setSubDriverError('');
                      setIsAddDriverSubModalOpen(true);
                    }}
                    addNewLabel="افزودن راننده جدید..."
                    placeholder="انتخاب راننده از لیست..."
                    options={[
                      { value: '', label: 'بدون راننده' },
                      ...persons.map(p => ({
                        value: p.fullName,
                        label: p.fullName
                      }))
                    ]}
                  />
                </div>
              </div>

              {/* شماره پلاک خودرو */}
              <div className="space-y-1.5 pt-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  شماره پلاک خودرو <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-[#1a1a1c] px-3 py-2 rounded-lg border border-slate-300 dark:border-[#2d2d30] min-h-[44px]">
                  <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">۲ رقم:</span>
                      <input 
                        type="text" 
                        maxLength={2}
                        placeholder="۱۲" 
                        value={vPlatePart1} 
                        onChange={e => {
                          const raw = e.target.value.replace(/[^\d۰-۹]/g, '').slice(0, 2);
                          setVPlatePart1(toPersianDigits(raw));
                        }} 
                        className="w-11 h-8 px-1.5 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#111113] text-slate-900 dark:text-white text-center font-mono font-bold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 w-28">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">حرف:</span>
                      <div className="flex-1">
                        <CustomSelect
                          value={vPlateLetter}
                          onChange={(val) => setVPlateLetter(val)}
                          searchable={false}
                          matchTriggerWidth={true}
                          size="8"
                          options={IRAN_PLATE_LETTERS.map(l => ({ value: l, label: l }))}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">۳ رقم:</span>
                      <input 
                        type="text" 
                        maxLength={3}
                        placeholder="۳۶۵" 
                        value={vPlatePart2} 
                        onChange={e => {
                          const raw = e.target.value.replace(/[^\d۰-۹]/g, '').slice(0, 3);
                          setVPlatePart2(toPersianDigits(raw));
                        }} 
                        className="w-14 h-8 px-1.5 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#111113] text-slate-900 dark:text-white text-center font-mono font-bold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <span className="text-slate-500 font-bold text-xs shrink-0 px-0.5">ایران</span>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">کد:</span>
                      <input 
                        type="text" 
                        maxLength={2}
                        placeholder="۱۱" 
                        value={vPlatePart3} 
                        onChange={e => {
                          const raw = e.target.value.replace(/[^\d۰-۹]/g, '').slice(0, 2);
                          setVPlatePart3(toPersianDigits(raw));
                        }} 
                        className="w-11 h-8 px-1.5 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#111113] text-slate-900 dark:text-white text-center font-mono font-bold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 sm:border-r border-slate-200 dark:border-[#2d2d30] pt-1.5 sm:pt-0 sm:pr-3">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">پیش‌نمایش:</span>
                    <div className="inline-flex items-stretch border border-slate-700 rounded bg-white text-slate-900 overflow-hidden shadow-xs select-none h-7 text-xs font-mono font-bold" style={{ direction: 'ltr' }}>
                      <div 
                        className="flex flex-col items-center justify-between w-4.5 h-full border-r border-slate-700 shrink-0 select-none overflow-hidden" 
                        style={{ 
                          direction: 'ltr',
                          backgroundColor: '#0033cc',
                          color: '#ffffff',
                          borderRadius: '3px 0 0 3px',
                          borderTopLeftRadius: '3px',
                          borderBottomLeftRadius: '3px',
                          borderTopRightRadius: '0px',
                          borderBottomRightRadius: '0px',
                        }}
                      >
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', borderRadius: 0 }}>
                          <div style={{ width: '100%', height: '2.8px', backgroundColor: '#009933', borderRadius: 0 }}></div>
                          <div style={{ width: '100%', height: '2.8px', backgroundColor: '#ffffff', borderRadius: 0 }}></div>
                          <div style={{ width: '100%', height: '2.8px', backgroundColor: '#e50000', borderRadius: 0 }}></div>
                        </div>
                        <span 
                          style={{ 
                            color: '#ffffff',
                            fontSize: '7.5px',
                            fontWeight: 600,
                            fontFamily: 'sans-serif',
                            lineHeight: 1,
                            letterSpacing: '0.6px',
                            paddingBottom: '4.5px',
                          }}
                        >
                          IR
                        </span>
                      </div>
                      <div className="flex items-center px-1.5 gap-1 bg-white text-black font-extrabold font-mono" style={{ direction: 'ltr' }}>
                        <span className={!vPlatePart1 ? 'text-slate-300' : ''}>{vPlatePart1 ? toPersianDigits(vPlatePart1) : '--'}</span>
                        <span className="text-emerald-800 font-bold px-0.5 font-sans text-[10px]">{vPlatePart1 || vPlatePart2 ? vPlateLetter : '-'}</span>
                        <span className={!vPlatePart2 ? 'text-slate-300' : ''}>{vPlatePart2 ? toPersianDigits(vPlatePart2) : '---'}</span>
                      </div>
                      <div className="w-[1px] bg-slate-700 h-full shrink-0"></div>
                      <div className="bg-white flex flex-col items-center justify-center w-7 h-full text-[9px] leading-tight shrink-0">
                        <span className="text-[5px] text-slate-800 font-extrabold leading-none mb-0.5 font-sans">ایران</span>
                        <span className={`text-[10px] font-mono font-bold leading-none ${!vPlatePart3 ? 'text-slate-300' : 'text-slate-900'}`}>{vPlatePart3 ? toPersianDigits(vPlatePart3) : '--'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ۲. راننده (دقیقاً فیلدهای PersonsView.tsx) */}
          {entityType === 'driver' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  نام و نام خانوادگی راننده <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: علی محمدی"
                  value={pFullName}
                  onChange={e => setPFullName(e.target.value)}
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  شماره تماس (موبایل)
                </label>
                <input
                  type="text"
                  placeholder="09123456789"
                  value={pPhone}
                  onChange={e => setPPhone(e.target.value)}
                  className={`w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border ${
                    duplicatePerson ? 'border-rose-500 dark:border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-[#2d2d30] focus:ring-indigo-500'
                  } rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 font-mono text-left`}
                />
                {duplicatePerson ? (
                  <p className="text-[10px] text-rose-500 dark:text-rose-400 font-medium">
                    شماره تکراری است و متعلق به «{duplicatePerson.fullName}» می‌باشد.
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">شماره تماس باید یکتا باشد و تکراری ثبت نمی‌شود.</p>
                )}
              </div>
            </div>
          )}

          {/* ۳. تامین‌کننده (دقیقاً فیلدهای SuppliersView.tsx) */}
          {entityType === 'supplier' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  نام تامین‌کننده / فروشگاه <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={sName}
                  onChange={(e) => setSName(e.target.value)}
                  placeholder="مثال: بازرگانی پارت سنتر یا فروشگاه لنت البرز"
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  شماره تماس <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={sPhone}
                  onChange={(e) => setSPhone(e.target.value)}
                  placeholder="مثال: 02133991122 یا 09121112233"
                  className={`w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border ${
                    duplicateSupplier ? 'border-rose-500 dark:border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-[#2d2d30] focus:border-indigo-500'
                  } rounded-lg px-3 py-2.5 text-xs font-bold text-left focus:outline-none font-mono`}
                />
                {duplicateSupplier ? (
                  <p className="text-[10px] text-rose-500 dark:text-rose-400 font-medium">
                    شماره تکراری است و متعلق به «{duplicateSupplier.name}» در این بخش می‌باشد.
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">شماره در بخش تامین‌کنندگان نباید تکراری باشد.</p>
                )}
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  آدرس
                </label>
                <input
                  type="text"
                  value={sAddress}
                  onChange={(e) => setSAddress(e.target.value)}
                  placeholder="مثال: تهران، خیابان چراغ برق، پاساژ کاشانی، پلاک ۱۲"
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* ۴. تعمیرکار (دقیقاً فیلدهای MechanicsView.tsx) */}
          {entityType === 'mechanic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  نام و نام خانوادگی تعمیرکار <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  placeholder="مثال: رضا کریمی"
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  شماره تماس تعمیرکار <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={mPhone}
                  onChange={(e) => setMPhone(e.target.value)}
                  placeholder="مثال: 09123456789"
                  className={`w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border ${
                    duplicateMechanic ? 'border-rose-500 dark:border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-[#2d2d30] focus:border-indigo-500'
                  } rounded-lg px-3 py-2.5 text-xs font-bold text-left focus:outline-none font-mono`}
                />
                {duplicateMechanic ? (
                  <p className="text-[10px] text-rose-500 dark:text-rose-400 font-medium">
                    شماره تکراری است و متعلق به «{duplicateMechanic.name}» در این بخش می‌باشد.
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">شماره در بخش تعمیرکاران نباید تکراری باشد.</p>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    تخصص اصلی
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddSpecialtyModalOpen(true)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن تخصص جدید</span>
                  </button>
                </div>
                <CustomSelect
                  value={mSpecialty}
                  onChange={(val) => setMSpecialty(val)}
                  searchable={true}
                  options={mechanicSpecialties.map(spec => ({ value: spec, label: spec }))}
                  onAddNew={() => setIsAddSpecialtyModalOpen(true)}
                  addNewLabel="افزودن تخصص جدید..."
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  آدرس <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={mShopName}
                  onChange={(e) => setMShopName(e.target.value)}
                  placeholder="مثال: تعمیرگاه مرکزی شماره ۱، خیابان آزادی..."
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* ۵. شرکت (دقیقاً فیلدهای CompaniesView.tsx) */}
          {entityType === 'company' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    نام شرکت / سازمان <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    placeholder="مثال: شرکت نفت پاسارگاد"
                    className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    وضعیت شرکت
                  </label>
                  <CustomSelect
                    value={cStatus}
                    onChange={(val) => setCStatus(val as 'active' | 'inactive')}
                    options={[
                      { value: 'active', label: 'فعال' },
                      { value: 'inactive', label: 'غیرفعال' }
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  آدرس کامل
                </label>
                <textarea
                  value={cAddress}
                  onChange={(e) => setCAddress(e.target.value)}
                  placeholder="مثال: تهران، خیابان فاطمی، پلاک ۱۱۰"
                  rows={3}
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* ۶. خدمت دوره‌ای (دقیقاً فیلدهای ServiceDefinitionsView.tsx) */}
          {entityType === 'service' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  عنوان خدمت <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={sdTitle}
                  onChange={(e) => setSdTitle(e.target.value)}
                  placeholder="مانند تعویض روغن موتور، تعویض تسمه تایم..."
                  className="w-full bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    زمان / دوره تعویض (کیلومتر) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={sdIntervalKm ? formatNumber(sdIntervalKm) : ''}
                    onChange={(e) => setSdIntervalKm(parsePersianNumber(e.target.value))}
                    placeholder="مثلاً: ۵۰۰۰"
                    className="w-full bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs text-indigo-700 dark:text-indigo-300 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                  <span className="text-[10px] text-slate-500 block">هر چند کیلومتر یک‌بار</span>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-amber-700 dark:text-amber-300 block">
                    بازه اخطار (کیلومتر) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={sdWarningKm ? formatNumber(sdWarningKm) : ''}
                    onChange={(e) => setSdWarningKm(parsePersianNumber(e.target.value))}
                    placeholder="مثلاً: ۲۰۰"
                    className="w-full bg-white dark:bg-[#1a1a1c] border border-amber-300 dark:border-amber-500/30 rounded-lg px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    required
                  />
                  <span className="text-[10px] text-amber-600 dark:text-amber-400/80 block">چند کیلومتر قبل هشدار</span>
                </div>
              </div>
            </div>
          )}

          {/* ۷. قطعه انبار (دقیقاً فیلدهای PartFormModal در InventoryModals.tsx) */}
          {entityType === 'part' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  نام قطعه / کالا <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: لنت ترمز جلو، روغن ۱۰W۴۰، فیلتر هوا..."
                  value={partName}
                  onChange={e => setPartName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500 font-bold text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    قیمت خرید واحد (ریال)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={partBuyPrice ? formatNumber(partBuyPrice) : ''}
                    onChange={e => {
                      const newBuy = parsePersianNumber(e.target.value);
                      setPartBuyPrice(newBuy);
                      if (!partSellPrice || partSellPrice === Math.round((Number(partBuyPrice) || 0) * 1.25)) {
                        setPartSellPrice(Math.round(newBuy * 1.25));
                      }
                    }}
                    placeholder="مثال: ۲۰۰,۰۰۰"
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-emerald-600 dark:text-emerald-400 font-mono font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    قیمت فروش واحد (ریال)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={partSellPrice ? formatNumber(partSellPrice) : ''}
                    onChange={e => setPartSellPrice(parsePersianNumber(e.target.value))}
                    placeholder="مثال: ۲۵۰,۰۰۰"
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-indigo-600 dark:text-indigo-400 font-mono font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    حداقل هشدار (تعداد)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={partMinQty ? formatNumber(partMinQty) : ''}
                    onChange={e => setPartMinQty(parsePersianNumber(e.target.value))}
                    placeholder="مثال: ۵"
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  موقعیت فیزیکی در انبار
                </label>
                <input
                  type="text"
                  placeholder="مثال: قفسه A-3، ردیف ۲ انبار مرکزی"
                  value={partLocation}
                  onChange={e => setPartLocation(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500 text-xs"
                />
              </div>
            </div>
          )}

          {/* ۸. تعریف نوع خرابی (مطابق با FailureDefinitionsView.tsx) */}
          {entityType === 'failure' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  عنوان و نوع خرابی <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={failType}
                  onChange={(e) => setFailType(e.target.value)}
                  placeholder="مانند نقص در سیستم ترمز ABS، روغن‌ریزی هیدرولیک، سوختن دینام..."
                  className="w-full bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  دسته خرابی <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  value={failCat}
                  onChange={(val) => setFailCat(String(val))}
                  placeholder="-- انتخاب دسته‌بندی خرابی --"
                  searchable={true}
                  matchTriggerWidth={true}
                  options={[
                    ...(failureCategories || []).map((cat) => ({
                      value: cat.name,
                      label: cat.name,
                      subLabel: cat.description || undefined
                    })),
                    { value: 'عمومی', label: 'عمومی / سایر' }
                  ]}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  شرح، علائم و توضیحات تکمیلی
                </label>
                <textarea
                  value={failDesc}
                  onChange={(e) => setFailDesc(e.target.value)}
                  rows={3}
                  placeholder="علائم خرابی، عواقب یا نکات مرتبط با این عیب فنی..."
                  className="w-full bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-medium"
                />
              </div>
            </div>
          )}

          {/* دکمه‌های ثبت و انصراف */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#2d2d30]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 font-bold rounded-md transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md transition-colors active:scale-95 text-xs cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ثبت...' : 'ثبت و ذخیره'}</span>
            </button>
          </div>
        </form>
      </div>

      <AddMechanicSpecialtyModal
        isOpen={isAddSpecialtyModalOpen}
        onClose={() => setIsAddSpecialtyModalOpen(false)}
        onSpecialtyAdded={(newSpec) => setMSpecialty(newSpec)}
        existingSpecialties={mechanicSpecialties}
      />

      {/* مدال افزودن شرکت جدید به عنوان زیرمدال در فرم خودرو */}
      {isAddCompanySubModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 backdrop-blur-xs p-3">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">افزودن و تعریف شرکت جدید</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCompanySubModalOpen(false)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSubCompany} className="p-4 space-y-3.5 text-xs">
              {subCompanyError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-600 dark:text-rose-400 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{subCompanyError}</span>
                </div>
              )}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  نام شرکت / سازمان <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="مثال: شرکت نفت پاسارگاد"
                  value={subCompanyName}
                  onChange={e => setSubCompanyName(e.target.value)}
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">وضعیت شرکت</label>
                <CustomSelect
                  value={subCompanyStatus}
                  onChange={(val) => setSubCompanyStatus(val as 'active' | 'inactive')}
                  options={[
                    { value: 'active', label: 'فعال' },
                    { value: 'inactive', label: 'غیرفعال' }
                  ]}
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">آدرس کامل</label>
                <textarea
                  value={subCompanyAddress}
                  onChange={e => setSubCompanyAddress(e.target.value)}
                  placeholder="مثال: تهران، خیابان فاطمی، پلاک ۱۱۰"
                  rows={2}
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#2d2d30]">
                <button
                  type="button"
                  onClick={() => setIsAddCompanySubModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-md text-xs cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSubCompany}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md text-xs cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmittingSubCompany ? 'در حال ثبت...' : 'ثبت شرکت و انتخاب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مدال افزودن راننده جدید به عنوان زیرمدال در فرم خودرو */}
      {isAddDriverSubModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 backdrop-blur-xs p-3">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">افزودن و تعریف راننده جدید</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDriverSubModalOpen(false)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSubDriver} className="p-4 space-y-3.5 text-xs">
              {subDriverError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-600 dark:text-rose-400 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{subDriverError}</span>
                </div>
              )}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  نام و نام خانوادگی <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="مثال: علی رضایی"
                  value={subDriverFullName}
                  onChange={e => setSubDriverFullName(e.target.value)}
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  شماره تماس (موبایل)
                </label>
                <input
                  type="text"
                  placeholder="09123456789"
                  value={subDriverPhone}
                  onChange={e => setSubDriverPhone(e.target.value)}
                  className={`w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border ${
                    duplicateSubDriver ? 'border-rose-500 dark:border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-[#2d2d30] focus:ring-indigo-500'
                  } rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:ring-1`}
                />
                {duplicateSubDriver ? (
                  <p className="text-[10px] text-rose-500 font-medium">
                    این شماره متعلق به «{duplicateSubDriver.fullName}» می‌باشد.
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400">شماره تماس باید یکتا باشد.</p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#2d2d30]">
                <button
                  type="button"
                  onClick={() => setIsAddDriverSubModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-md text-xs cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSubDriver}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md text-xs cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmittingSubDriver ? 'در حال ثبت...' : 'ثبت راننده و انتخاب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
