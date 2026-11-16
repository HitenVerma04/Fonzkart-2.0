'use client';

import { useState } from 'react';
import BrandManager from './BrandManager';
import ModelManager from './ModelManager';
// VariantManager is removed as it's merged into ModelManager
import PricingRulesManager from './PricingRulesManager';
import { Brand, Model, Variant } from '@/lib/store';
import type { PricingSettings } from '@/actions/admin';

interface Props {
    category: string;
    brands: Brand[];
    models: Model[];
    variants: Variant[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rules?: any[];
    pricing?: PricingSettings | null;
}

type Tab = 'brands' | 'models' | 'rules';

export default function ClientCategoryManager({ category, brands, models, variants, rules, pricing }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('models');
    const [selectedBrandId, setSelectedBrandId] = useState<string>('all');

    // Helper for display title
    const titleMap: Record<string, string> = {
        'smartphone': 'Smartphones',
        'tablet': 'Tablets',
        'watch': 'Smartwatches',
        'laptop': 'Laptops',
        'console': 'Gaming Consoles',
        'tv': 'Smart TVs',
        'camera': 'DSLR Cameras',
        'desktop': 'Desktops',
        'earbuds': 'Earbuds',
        'repair-device': 'Repair Devices'
    };

    const formatTitle = (slug: string) => {
        if (titleMap[slug]) return titleMap[slug];
        return slug.split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const title = formatTitle(category);

    // Filter logic
    const filteredModels = selectedBrandId === 'all'
        ? models
        : models.filter(m => m.brandId === selectedBrandId);

    // Filter variants that belong to the filtered models
    // (Optimization: Pass only relevant variants to ModelManager if needed, but easier to pass all and let ModelManager find them per model)
    const relevantVariants = variants;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <h1 className="text-3xl font-bold tracking-tight">Manage {title}</h1>

                {/* Main Tab Navigation */}
                <div className="flex p-1 bg-muted rounded-lg w-fit">
                    <button
                        onClick={() => setActiveTab('brands')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'brands'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Brands
                    </button>
                    <button
                        onClick={() => setActiveTab('models')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'models'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Models & Pricing
                    </button>
                    <button
                        onClick={() => setActiveTab('rules')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'rules'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Condition Rules
                    </button>
                </div>

                {/* Brand Filter (Visible for Models tab only) */}
                {activeTab === 'models' && (
                    <div className="w-full">
                        <div className="flex overflow-x-auto pb-2 gap-2 [&::-webkit-scrollbar]:hidden items-center">
                            <span className="text-sm font-medium text-muted-foreground mr-2 shrink-0">Filter:</span>
                            <button
                                onClick={() => setSelectedBrandId('all')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap border transition-all ${selectedBrandId === 'all'
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                        : 'bg-background hover:bg-muted text-muted-foreground border-border'
                                    }`}
                            >
                                All Brands
                            </button>
                            {brands.map(brand => (
                                <button
                                    key={brand.id}
                                    onClick={() => setSelectedBrandId(brand.id)}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap border transition-all ${selectedBrandId === brand.id
                                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                            : 'bg-background hover:bg-muted text-muted-foreground border-border'
                                        }`}
                                >
                                    {brand.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="border rounded-xl p-6 bg-card min-h-[500px]">
                {activeTab === 'brands' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold">Brands</h2>
                            <p className="text-sm text-muted-foreground">Brands associated with {title}</p>
                        </div>
                        <BrandManager initialBrands={brands} category={category} />
                    </div>
                )}

                {activeTab === 'models' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold">Models</h2>
                            <p className="text-sm text-muted-foreground">
                                {selectedBrandId !== 'all'
                                    ? `Managing ${brands.find(b => b.id === selectedBrandId)?.name} Models`
                                    : `Add or Edit ${title} Models`}
                            </p>
                        </div>
                        {/* We pass variants here now */}
                        <ModelManager
                            brands={brands}
                            initialModels={filteredModels}
                            initialVariants={relevantVariants}
                            preselectedCategory={category}
                        />
                    </div>
                )}

                {activeTab === 'rules' && (
                    <div className="space-y-8">
                        <div>
                            <div className="mb-4">
                                <h2 className="text-xl font-bold">Condition Pricing</h2>
                                <p className="text-sm text-muted-foreground">How much each answer takes off the max value, and the lowest offer.</p>
                            </div>
                            <PricingRulesManager category={category} initialRules={rules || []} pricing={pricing ?? null} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
