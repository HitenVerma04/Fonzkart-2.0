
import { db } from '@/lib/store';
import ClientCategoryManager from '@/components/admin/ClientCategoryManager';
import { redirect } from 'next/navigation';
import { ADMINS, hasStaffRole } from '@/lib/staff-access';

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
    // Catalog and pricing rules are for administrators (sidebar "Inventory": SUPER_ADMIN and ADMIN only).
    if (!(await hasStaffRole(ADMINS))) redirect('/admin');

    const { slug } = await params;

    // Fetch Data Server Side
    const brands = await db.getBrands(slug); // Fetch filtered brands for this category
    // Ideally user wants filtered brands view? 
    // "BrandManager" handles generic brands. Let's pass all brands so they can be selected.

    // Fetch Models for this category
    const models = await db.getModels(undefined, slug);

    // Fetch Variants (filtered by models later, or fetch all)
    // db.getVariants() fetches all. We can optimize later.
    const variants = await db.getVariants();

    // Filter variants that belong to models of this category
    const categoryModelIds = new Set(models.map(m => m.id));
    const categoryVariants = variants.filter(v => categoryModelIds.has(v.modelId));

    // Fetch Evaluation/Pricing Rules
    const rulesRaw = await db.getEvaluationRules(slug);
    const rules = JSON.parse(JSON.stringify(rulesRaw));

    return (
        <ClientCategoryManager
            category={slug}
            brands={brands}
            models={models}
            variants={categoryVariants}
            rules={rules}
        />
    );
}
