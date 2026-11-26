// Buying refurbished devices and booking doorstep repairs (backend: BuyRepairController), the same data and wording
// as the Customer and Admin apps (mobile/packages/api/src/buyRepair.ts).
import type { ShopOrderStatus } from '@/lib/shop';

export type DeviceGrade = 'superb' | 'good' | 'fair';

/** The condition grades, best first. */
export const DEVICE_GRADES: { id: DeviceGrade; label: string; detail: string }[] = [
    { id: 'superb', label: 'Superb', detail: 'Looks like new, with no visible marks.' },
    { id: 'good', label: 'Good', detail: 'Light marks you may notice up close.' },
    { id: 'fair', label: 'Fair', detail: 'Visible signs of use. Works perfectly.' },
];

export const gradeLabel = (id: string) => DEVICE_GRADES.find(g => g.id === id)?.label ?? id;

export type RefurbishedDevice = {
    id: string;
    name: string;
    brand: string;
    /** e.g. "128 GB" or "8 GB / 128 GB". */
    storage: string;
    grade: DeviceGrade;
    warrantyMonths: number;
    imageUrl: string | null;
    mrp: number;
    price: number;
    stock: number;
    isActive: boolean;
    displayOrder: number;
};

export type RefurbishedDeviceInput = Omit<RefurbishedDevice, 'id' | 'displayOrder'> & { displayOrder?: number };

export type RefurbishedStore = { enabled: boolean; items: RefurbishedDevice[] };

export type RefurbishedOrder = {
    id: string;
    orderNumber: number;
    status: ShopOrderStatus;
    deviceId: string;
    deviceName: string;
    storage: string;
    grade: DeviceGrade;
    warrantyMonths: number;
    imageUrl: string | null;
    price: number;
    mrp: number;
    name: string;
    phone: string;
    address: string;
    pincode: string;
    paymentMethod: 'cod';
    createdAt: string;
    customerEmail?: string | null;
};

export type RepairIssue = 'screen' | 'battery' | 'charging' | 'camera' | 'speaker' | 'back';

export const REPAIR_ISSUES: { id: RepairIssue; label: string; detail: string }[] = [
    { id: 'screen', label: 'Screen replacement', detail: 'Cracked, black or unresponsive display' },
    { id: 'battery', label: 'Battery replacement', detail: 'Drains fast or shuts down' },
    { id: 'charging', label: 'Charging port', detail: 'Loose, or will not charge' },
    { id: 'camera', label: 'Camera', detail: 'Blurry, cracked lens or not opening' },
    { id: 'speaker', label: 'Speaker and mic', detail: 'Low sound, or callers cannot hear you' },
    { id: 'back', label: 'Back glass', detail: 'Cracked back panel' },
];

export const issueLabel = (id: string) => REPAIR_ISSUES.find(i => i.id === id)?.label ?? id;

export type RepairSlot = 'morning' | 'afternoon' | 'evening';

export const REPAIR_SLOTS: { id: RepairSlot; label: string; time: string }[] = [
    { id: 'morning', label: 'Morning', time: '9 am to 12 pm' },
    { id: 'afternoon', label: 'Afternoon', time: '12 pm to 4 pm' },
    { id: 'evening', label: 'Evening', time: '4 pm to 8 pm' },
];

export type RepairStatus = 'booked' | 'confirmed' | 'completed' | 'cancelled';

export const REPAIR_STATUSES: { id: RepairStatus; label: string }[] = [
    { id: 'booked', label: 'Booked' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
];

export type RepairPrice = {
    id: string;
    brand: string;
    model: string;
    issue: RepairIssue;
    /** The fixed price, or the lowest of a range. */
    price: number;
    /** The highest of a price range; null for a fixed price. */
    priceMax?: number | null;
    isActive: boolean;
    displayOrder: number;
};

export type RepairPriceInput = Omit<RepairPrice, 'id' | 'displayOrder'> & { displayOrder?: number };

export type RepairPriceList = { enabled: boolean; items: RepairPrice[] };

export type RepairBooking = {
    id: string;
    bookingNumber: number;
    status: RepairStatus;
    brand: string;
    model: string;
    issue: RepairIssue;
    price: number;
    /** The highest of the range at the time of the booking; null for a fixed price. */
    priceMax?: number | null;
    /** YYYY-MM-DD */
    visitDate: string;
    slot: RepairSlot;
    name: string;
    phone: string;
    address: string;
    pincode: string;
    createdAt: string;
    customerEmail?: string | null;
};

/** A card of the Customer app's home-page carousel (backend: CarouselController). */
export type CarouselSlide = {
    id: string;
    imageUrl: string;
    title: string;
    subtitle: string;
    category: string | null;
    isActive: boolean;
    displayOrder: number;
};

export type CarouselSlideInput = Omit<CarouselSlide, 'id' | 'displayOrder'> & { displayOrder?: number };

export type PincodeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type PincodeRequestItem = {
    id: string;
    partnerId: string;
    pincodes: string[];
    note: string | null;
    status: PincodeRequestStatus;
    approved: string[];
    reviewNote: string | null;
    reviewedAt: string | null;
    createdAt: string;
};

export type PincodeCity = { id: string; name: string; pincodes: string[] };

export type PincodeRequestForReview = PincodeRequestItem & {
    partner: { id: string; name: string; email: string; phone: string | null; pincodes: string[] } | null;
    city: PincodeCity | null;
};

export type MyPincodes = { pincodes: string[]; city: PincodeCity | null; requests: PincodeRequestItem[] };

export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** A price or a price range: "₹7,000" or "₹7,000 – ₹10,000" (as formatInrRange in the apps). */
export const inrRange = (min: number, max?: number | null) => (max != null && max > min ? `${inr(min)} – ${inr(max)}` : inr(min));

/** Shown with a price range. */
export const RANGE_NOTE = 'The technician checks your phone and tells you the exact price within this range before starting.';

/** A picture path from the backend (/uploads/…) or a full URL, as an <img> src. */
export const pictureSrc = (path: string | null | undefined) => (path ? path : null);
