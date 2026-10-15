// The Admin app's sections by role: the same as the website's admin sidebar (components/admin/AdminSidebar.tsx).
export type Section = {
  href: '/orders' | '/partners' | '/riders' | '/cities' | '/zonal-heads' | '/users' | '/rm' | '/pricing' | '/catalog' | '/homepage' | '/email';
  title: string;
  detail: string;
  roles: string[];
};

const ADMINS = ['SUPER_ADMIN', 'ADMIN'];
const ZH = 'ZONAL_HEAD';
const RM = 'RELATIONSHIP_MANAGER';

export const SECTIONS: Section[] = [
  { href: '/orders', title: 'Orders', detail: 'Route, assign, approve prices, payouts, hub', roles: [...ADMINS, ZH, RM] },
  { href: '/rm', title: 'RM dashboard', detail: 'Your partners and delayed orders', roles: [RM] },
  { href: '/partners', title: 'Partners', detail: 'Register, assign RM and zonal head, pincodes', roles: [...ADMINS, ZH, RM] },
  { href: '/riders', title: 'Field executives', detail: 'Add and remove executives', roles: [...ADMINS, ZH, RM] },
  { href: '/cities', title: 'Cities', detail: 'Hubs, pincodes, live and featured cities', roles: [...ADMINS, ZH] },
  { href: '/zonal-heads', title: 'Zonal heads', detail: 'Create and assign cities', roles: ADMINS },
  { href: '/users', title: 'Users & roles', detail: 'Admins, relationship managers, directory', roles: ADMINS },
  { href: '/pricing', title: 'Pricing rules', detail: 'Deductions per answer and category', roles: ADMINS },
  { href: '/catalog', title: 'Catalog', detail: 'Brands, models, variants and pictures', roles: ADMINS },
  { href: '/homepage', title: 'Landing page', detail: 'Banner prices and featured cities', roles: ADMINS },
  { href: '/email', title: 'Email', detail: 'The Fonzkart mailboxes', roles: [...ADMINS, ZH, RM] },
];

/** Roles that use this app; partners and field executives use the Partner app. */
export const ADMIN_APP_ROLES = [...ADMINS, ZH, RM];

export const sectionsFor = (role: string) => SECTIONS.filter(s => s.roles.includes(role));
