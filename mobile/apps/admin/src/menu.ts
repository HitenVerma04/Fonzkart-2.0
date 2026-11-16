// The Admin app's sections by role: the same as the website's admin sidebar (components/admin/AdminSidebar.tsx),
// plus "Edit carousel view", the festive theme and the screen guard store, which only the Customer app has.
export type Section = {
  href: '/orders' | '/partners' | '/pincode-requests' | '/riders' | '/cities' | '/zonal-heads' | '/users' | '/rm' | '/pricing' | '/pricing-engine' | '/catalog' | '/homepage'
    | '/carousel' | '/festive-theme' | '/screen-guards' | '/shop-orders' | '/refurbished' | '/buy-orders' | '/repair-prices' | '/repair-bookings' | '/email';
  title: string;
  detail: string;
  roles: string[];
  group: Group;
};

/** The dashboard shows the sections under these headings, in this order. */
export const GROUPS = ['Orders', 'People & places', 'Sell: prices & catalog', 'Store, Buy & Repair', 'Customer app', 'Mail'] as const;
export type Group = typeof GROUPS[number];

const ADMINS = ['SUPER_ADMIN', 'ADMIN'];
const ZH = 'ZONAL_HEAD';
const RM = 'RELATIONSHIP_MANAGER';

export const SECTIONS: Section[] = [
  { href: '/orders', title: 'Orders', detail: 'Route, assign, approve prices, payouts, hub', roles: [...ADMINS, ZH, RM], group: 'Orders' },
  { href: '/rm', title: 'RM dashboard', detail: 'Your partners and delayed orders', roles: [RM], group: 'Orders' },
  { href: '/partners', title: 'Partners', detail: 'Register, assign RM and zonal head, pincodes', roles: [...ADMINS, ZH, RM], group: 'People & places' },
  { href: '/pincode-requests', title: 'Pincode requests', detail: 'Partners asking to serve more pincodes', roles: [...ADMINS, ZH], group: 'People & places' },
  { href: '/riders', title: 'Field executives', detail: 'Add and remove executives', roles: [...ADMINS, ZH, RM], group: 'People & places' },
  { href: '/cities', title: 'Cities', detail: 'Hubs, pincodes, live and featured cities', roles: [...ADMINS, ZH], group: 'People & places' },
  { href: '/zonal-heads', title: 'Zonal heads', detail: 'Create and assign cities', roles: ADMINS, group: 'People & places' },
  { href: '/users', title: 'Users & roles', detail: 'Admins, relationship managers, directory', roles: ADMINS, group: 'People & places' },
  { href: '/pricing-engine', title: 'Pricing engine', detail: 'Suggestions, resales, repair costs, automation', roles: ADMINS, group: 'Sell: prices & catalog' },
  { href: '/pricing', title: 'Pricing rules', detail: 'Deductions per answer and category', roles: ADMINS, group: 'Sell: prices & catalog' },
  { href: '/catalog', title: 'Catalog', detail: 'Brands, models, variants and pictures', roles: ADMINS, group: 'Sell: prices & catalog' },
  { href: '/homepage', title: 'Landing page', detail: 'Banner prices and featured cities', roles: ADMINS, group: 'Customer app' },
  { href: '/carousel', title: 'Edit carousel view', detail: 'Cards on the Customer app home screen', roles: ADMINS, group: 'Customer app' },
  { href: '/festive-theme', title: 'Festive theme', detail: 'Republic Day, Independence Day, Eid, Diwali, Christmas', roles: ADMINS, group: 'Customer app' },
  { href: '/screen-guards', title: 'Screen guard store', detail: 'Guards, prices, discounts and store switch', roles: ADMINS, group: 'Store, Buy & Repair' },
  { href: '/shop-orders', title: 'Shop orders', detail: 'Screen guard orders, cash on delivery', roles: ADMINS, group: 'Store, Buy & Repair' },
  { href: '/refurbished', title: 'Refurbished devices', detail: 'Devices for sale, grades, prices and stock', roles: ADMINS, group: 'Store, Buy & Repair' },
  { href: '/buy-orders', title: 'Device orders', detail: 'Refurbished devices ordered, cash on delivery', roles: ADMINS, group: 'Store, Buy & Repair' },
  { href: '/repair-prices', title: 'Repair prices', detail: 'Fixed prices per phone and repair', roles: ADMINS, group: 'Store, Buy & Repair' },
  { href: '/repair-bookings', title: 'Repair bookings', detail: 'Doorstep repair visits', roles: ADMINS, group: 'Store, Buy & Repair' },
  { href: '/email', title: 'Email', detail: 'The Fonzkart mailboxes', roles: [...ADMINS, ZH, RM], group: 'Mail' },
];

/** Roles that use this app; partners and field executives use the Partner app. */
export const ADMIN_APP_ROLES = [...ADMINS, ZH, RM];

export const sectionsFor = (role: string) => SECTIONS.filter(s => s.roles.includes(role));
