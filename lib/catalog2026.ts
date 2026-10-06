export interface CatalogModel2026 {
    id: string;
    brandId: string;
    name: string;
    img: string;
    category: string;
    priority: number;
    variants: { id: string; name: string; basePrice: number }[];
}

export const CATALOG_2026_MODELS: CatalogModel2026[] = [
    // -------------------------------------------------------------
    // Samsung (9 Models)
    // -------------------------------------------------------------
    {
        id: 'galaxy-s26-ultra-5g',
        brandId: 'samsung',
        name: 'Galaxy S26 Ultra 5G',
        img: '/models/samsung/s26_ultra.jpg',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'galaxy-s26-ultra-5g-12-256', name: '12GB + 256GB', basePrice: 78540 },
            { id: 'galaxy-s26-ultra-5g-16-512', name: '16GB + 512GB', basePrice: 82500 },
        ]
    },
    {
        id: 'galaxy-s26-plus-5g',
        brandId: 'samsung',
        name: 'Galaxy S26+ 5G',
        img: '/models/samsung/Samsung_Galaxy_S25_Plus.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'galaxy-s26-plus-5g-12-256', name: '12GB + 256GB', basePrice: 56100 },
            { id: 'galaxy-s26-plus-5g-12-512', name: '12GB + 512GB', basePrice: 59000 },
        ]
    },
    {
        id: 'galaxy-s26-5g',
        brandId: 'samsung',
        name: 'Galaxy S26 5G',
        img: '/models/samsung/Samsung_Galaxy_S25.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'galaxy-s26-5g-12-128', name: '12GB + 128GB', basePrice: 44880 },
            { id: 'galaxy-s26-5g-12-256', name: '12GB + 256GB', basePrice: 47000 },
        ]
    },
    {
        id: 'galaxy-z-fold-8-ultra',
        brandId: 'samsung',
        name: 'Galaxy Z Fold 8 Ultra',
        img: '/models/samsung/Samsung_Galaxy_Z_Fold_7.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'galaxy-z-fold-8-ultra-16-512', name: '16GB + 512GB', basePrice: 100980 },
            { id: 'galaxy-z-fold-8-ultra-16-1tb', name: '16GB + 1TB', basePrice: 108000 },
        ]
    },
    {
        id: 'galaxy-z-fold-8',
        brandId: 'samsung',
        name: 'Galaxy Z Fold 8',
        img: '/models/samsung/Samsung_Galaxy_Z_Fold_6.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'galaxy-z-fold-8-12-256', name: '12GB + 256GB', basePrice: 89760 },
            { id: 'galaxy-z-fold-8-12-512', name: '12GB + 512GB', basePrice: 94000 },
        ]
    },
    {
        id: 'galaxy-z-flip-8',
        brandId: 'samsung',
        name: 'Galaxy Z Flip 8',
        img: '/models/samsung/Samsung_Galaxy_Z_Flip_7.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'galaxy-z-flip-8-12-256', name: '12GB + 256GB', basePrice: 56100 },
            { id: 'galaxy-z-flip-8-12-512', name: '12GB + 512GB', basePrice: 59000 },
        ]
    },
    {
        id: 'galaxy-f70-pro-5g',
        brandId: 'samsung',
        name: 'Galaxy F70 Pro 5G',
        img: '/models/samsung/Samsung_Galaxy_F56_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'galaxy-f70-pro-5g-8-128', name: '8GB + 128GB', basePrice: 14025 },
            { id: 'galaxy-f70-pro-5g-8-256', name: '8GB + 256GB', basePrice: 15500 },
        ]
    },
    {
        id: 'galaxy-m47-5g',
        brandId: 'samsung',
        name: 'Galaxy M47 5G',
        img: '/models/samsung/Samsung_Galaxy_M56_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'galaxy-m47-5g-6-128', name: '6GB + 128GB', basePrice: 11220 },
            { id: 'galaxy-m47-5g-8-128', name: '8GB + 128GB', basePrice: 12000 },
        ]
    },
    {
        id: 'galaxy-a86-5g',
        brandId: 'samsung',
        name: 'Galaxy A86 5G',
        img: '/models/samsung/Samsung_Galaxy_A56_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'galaxy-a86-5g-8-128', name: '8GB + 128GB', basePrice: 22440 },
            { id: 'galaxy-a86-5g-8-256', name: '8GB + 256GB', basePrice: 24000 },
        ]
    },

    // -------------------------------------------------------------
    // Redmi (Xiaomi) (8 Models)
    // -------------------------------------------------------------
    {
        id: 'redmi-turbo-5',
        brandId: 'xiaomi',
        name: 'Redmi Turbo 5',
        img: '/models/xiaomi/Xiaomi_15.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'redmi-turbo-5-8-256', name: '8GB + 256GB', basePrice: 23562 },
            { id: 'redmi-turbo-5-12-256', name: '12GB + 256GB', basePrice: 25000 },
        ]
    },
    {
        id: 'redmi-note-15-pro-plus-5g',
        brandId: 'xiaomi',
        name: 'Redmi Note 15 Pro+ 5G',
        img: '/models/xiaomi/Redmi_Note_15_Pro_Plus_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'redmi-note-15-pro-plus-5g-8-256', name: '8GB + 256GB', basePrice: 22440 },
            { id: 'redmi-note-15-pro-plus-5g-12-512', name: '12GB + 512GB', basePrice: 24000 },
        ]
    },
    {
        id: 'redmi-note-15-pro-5g',
        brandId: 'xiaomi',
        name: 'Redmi Note 15 Pro 5G',
        img: '/models/xiaomi/Redmi_Note_15_Pro_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'redmi-note-15-pro-5g-8-128', name: '8GB + 128GB', basePrice: 19635 },
            { id: 'redmi-note-15-pro-5g-8-256', name: '8GB + 256GB', basePrice: 21000 },
        ]
    },
    {
        id: 'redmi-note-15-5g',
        brandId: 'xiaomi',
        name: 'Redmi Note 15 5G',
        img: '/models/xiaomi/Redmi_Note_15_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'redmi-note-15-5g-6-128', name: '6GB + 128GB', basePrice: 15147 },
            { id: 'redmi-note-15-5g-8-256', name: '8GB + 256GB', basePrice: 16500 },
        ]
    },
    {
        id: 'redmi-note-15-se-5g',
        brandId: 'xiaomi',
        name: 'Redmi Note 15 SE 5G',
        img: '/models/xiaomi/Redmi_Note_14_SE_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'redmi-note-15-se-5g-6-128', name: '6GB + 128GB', basePrice: 14586 },
            { id: 'redmi-note-15-se-5g-8-128', name: '8GB + 128GB', basePrice: 15500 },
        ]
    },
    {
        id: 'redmi-note-17-5g',
        brandId: 'xiaomi',
        name: 'Redmi Note 17 5G',
        img: '/models/xiaomi/Redmi_Note_14_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'redmi-note-17-5g-8-128', name: '8GB + 128GB', basePrice: 17391 },
            { id: 'redmi-note-17-5g-8-256', name: '8GB + 256GB', basePrice: 18500 },
        ]
    },
    {
        id: 'redmi-15c-5g',
        brandId: 'xiaomi',
        name: 'Redmi 15C 5G',
        img: '/models/xiaomi/Redmi_15C_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'redmi-15c-5g-6-128', name: '6GB + 128GB', basePrice: 10378 },
            { id: 'redmi-15c-5g-8-128', name: '8GB + 128GB', basePrice: 11000 },
        ]
    },
    {
        id: 'redmi-15a-5g',
        brandId: 'xiaomi',
        name: 'Redmi 15A 5G',
        img: '/models/xiaomi/Redmi_15_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'redmi-15a-5g-4-128', name: '4GB + 128GB', basePrice: 8592 },
            { id: 'redmi-15a-5g-6-128', name: '6GB + 128GB', basePrice: 9200 },
        ]
    },

    // -------------------------------------------------------------
    // Realme (9 Models)
    // -------------------------------------------------------------
    {
        id: 'realme-gt6-pro-5g',
        brandId: 'realme',
        name: 'Realme GT6 Pro 5G',
        img: '/models/realme/Realme_GT_7_Pro_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'realme-gt6-pro-5g-12-256', name: '12GB + 256GB', basePrice: 33660 },
            { id: 'realme-gt6-pro-5g-16-512', name: '16GB + 512GB', basePrice: 36000 },
        ]
    },
    {
        id: 'realme-gt6-5g',
        brandId: 'realme',
        name: 'Realme GT6 5G',
        img: '/models/realme/Realme_GT_6.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'realme-gt6-5g-8-256', name: '8GB + 256GB', basePrice: 23001 },
            { id: 'realme-gt6-5g-12-256', name: '12GB + 256GB', basePrice: 25000 },
        ]
    },
    {
        id: 'realme-gt-neo-8-5g',
        brandId: 'realme',
        name: 'Realme GT Neo 8 5G',
        img: '/models/realme/REALME_GT_NEO_3_150W.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'realme-gt-neo-8-5g-8-256', name: '8GB + 256GB', basePrice: 20196 },
            { id: 'realme-gt-neo-8-5g-12-256', name: '12GB + 256GB', basePrice: 21500 },
        ]
    },
    {
        id: 'realme-14-pro-plus-5g',
        brandId: 'realme',
        name: 'Realme 14 Pro+ 5G',
        img: '/models/realme/Realme_14_Pro_Plus_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'realme-14-pro-plus-5g-8-256', name: '8GB + 256GB', basePrice: 18513 },
            { id: 'realme-14-pro-plus-5g-12-256', name: '12GB + 256GB', basePrice: 19500 },
        ]
    },
    {
        id: 'realme-14-pro-5g',
        brandId: 'realme',
        name: 'Realme 14 Pro 5G',
        img: '/models/realme/Realme_14_Pro_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'realme-14-pro-5g-8-128', name: '8GB + 128GB', basePrice: 15708 },
            { id: 'realme-14-pro-5g-8-256', name: '8GB + 256GB', basePrice: 16800 },
        ]
    },
    {
        id: 'realme-14-5g',
        brandId: 'realme',
        name: 'Realme 14 5G',
        img: '/models/realme/Realme_14X_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'realme-14-5g-6-128', name: '6GB + 128GB', basePrice: 11220 },
            { id: 'realme-14-5g-8-128', name: '8GB + 128GB', basePrice: 12000 },
        ]
    },
    {
        id: 'realme-narzo-80-pro',
        brandId: 'realme',
        name: 'Realme Narzo 80 Pro',
        img: '/models/realme/Realme_Narzo_80_Pro_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'realme-narzo-80-pro-8-128', name: '8GB + 128GB', basePrice: 12903 },
            { id: 'realme-narzo-80-pro-8-256', name: '8GB + 256GB', basePrice: 14000 },
        ]
    },
    {
        id: 'realme-narzo-80x-5g',
        brandId: 'realme',
        name: 'Realme Narzo 80x 5G',
        img: '/models/realme/Realme_Narzo_80X_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'realme-narzo-80x-5g-6-128', name: '6GB + 128GB', basePrice: 8976 },
            { id: 'realme-narzo-80x-5g-8-128', name: '8GB + 128GB', basePrice: 9500 },
        ]
    },
    {
        id: 'realme-c75-5g',
        brandId: 'realme',
        name: 'Realme C75 5G',
        img: '/models/realme/Realme_C75_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'realme-c75-5g-4-128', name: '4GB + 128GB', basePrice: 7293 },
            { id: 'realme-c75-5g-6-128', name: '6GB + 128GB', basePrice: 7900 },
        ]
    },

    // -------------------------------------------------------------
    // POCO (10 Models)
    // -------------------------------------------------------------
    {
        id: 'poco-f8-pro-5g',
        brandId: 'poco',
        name: 'POCO F8 Pro 5G',
        img: '/models/poco/Poco_F7.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'poco-f8-pro-5g-12-256', name: '12GB + 256GB', basePrice: 25245 },
            { id: 'poco-f8-pro-5g-16-512', name: '16GB + 512GB', basePrice: 27500 },
        ]
    },
    {
        id: 'poco-f8-5g',
        brandId: 'poco',
        name: 'POCO F8 5G',
        img: '/models/poco/Poco_F6_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'poco-f8-5g-8-256', name: '8GB + 256GB', basePrice: 19635 },
            { id: 'poco-f8-5g-12-256', name: '12GB + 256GB', basePrice: 21000 },
        ]
    },
    {
        id: 'poco-f8-gt-5g',
        brandId: 'poco',
        name: 'POCO F8 GT 5G',
        img: '/models/poco/POCO_F3_GT.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'poco-f8-gt-5g-8-256', name: '8GB + 256GB', basePrice: 22440 },
            { id: 'poco-f8-gt-5g-12-256', name: '12GB + 256GB', basePrice: 24000 },
        ]
    },
    {
        id: 'poco-x8-pro-5g',
        brandId: 'poco',
        name: 'POCO X8 Pro 5G',
        img: '/models/poco/Poco_X7_Pro_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'poco-x8-pro-5g-8-256', name: '8GB + 256GB', basePrice: 16269 },
            { id: 'poco-x8-pro-5g-12-256', name: '12GB + 256GB', basePrice: 17500 },
        ]
    },
    {
        id: 'poco-x8-5g',
        brandId: 'poco',
        name: 'POCO X8 5G',
        img: '/models/poco/Poco_X7_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'poco-x8-5g-8-128', name: '8GB + 128GB', basePrice: 12342 },
            { id: 'poco-x8-5g-8-256', name: '8GB + 256GB', basePrice: 13500 },
        ]
    },
    {
        id: 'poco-x8-neo-5g',
        brandId: 'poco',
        name: 'POCO X8 Neo 5G',
        img: '/models/poco/Poco_X6_Neo.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'poco-x8-neo-5g-6-128', name: '6GB + 128GB', basePrice: 10098 },
            { id: 'poco-x8-neo-5g-8-256', name: '8GB + 256GB', basePrice: 11000 },
        ]
    },
    {
        id: 'poco-m8-pro-5g',
        brandId: 'poco',
        name: 'POCO M8 Pro 5G',
        img: '/models/poco/Poco_M7_Pro_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'poco-m8-pro-5g-6-128', name: '6GB + 128GB', basePrice: 8415 },
            { id: 'poco-m8-pro-5g-8-128', name: '8GB + 128GB', basePrice: 9000 },
        ]
    },
    {
        id: 'poco-m8-5g',
        brandId: 'poco',
        name: 'POCO M8 5G',
        img: '/models/poco/Poco_M8_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'poco-m8-5g-4-128', name: '4GB + 128GB', basePrice: 6732 },
            { id: 'poco-m8-5g-6-128', name: '6GB + 128GB', basePrice: 7200 },
        ]
    },
    {
        id: 'poco-c8-5g',
        brandId: 'poco',
        name: 'POCO C8 5G',
        img: '/models/poco/Poco_C75_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'poco-c8-5g-4-128', name: '4GB + 128GB', basePrice: 5610 },
            { id: 'poco-c8-5g-6-128', name: '6GB + 128GB', basePrice: 6000 },
        ]
    },
    {
        id: 'poco-c8-plus',
        brandId: 'poco',
        name: 'POCO C8 Plus',
        img: '/models/poco/POCO_C85.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'poco-c8-plus-4-64', name: '4GB + 64GB', basePrice: 5049 },
            { id: 'poco-c8-plus-4-128', name: '4GB + 128GB', basePrice: 5500 },
        ]
    },

    // -------------------------------------------------------------
    // OnePlus (4 Models)
    // -------------------------------------------------------------
    {
        id: 'oneplus-n6',
        brandId: 'oneplus',
        name: 'OnePlus N6',
        img: '/models/oneplus/OnePlus_Nord_N20_SE.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'oneplus-n6-4-128', name: '4GB + 128GB', basePrice: 16000 },
            { id: 'oneplus-n6-6-256', name: '6GB + 256GB', basePrice: 17300 },
        ]
    },
    {
        id: 'oneplus-nord-ce-6-5g',
        brandId: 'oneplus',
        name: 'OnePlus Nord CE 6 5G',
        img: '/models/oneplus/OnePlus_Nord_CE_5_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'oneplus-nord-ce-6-5g-6-128', name: '6GB + 128GB', basePrice: 18400 },
            { id: 'oneplus-nord-ce-6-5g-8-128', name: '8GB + 128GB', basePrice: 19000 },
            { id: 'oneplus-nord-ce-6-5g-12-256', name: '12GB + 256GB', basePrice: 19500 },
        ]
    },
    {
        id: 'oneplus-nord-ce-6-lite',
        brandId: 'oneplus',
        name: 'OnePlus Nord CE 6 Lite',
        img: '/models/oneplus/OnePlus_Nord_CE4_Lite_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'oneplus-nord-ce-6-lite-6-128', name: '6GB + 128GB', basePrice: 16700 },
            { id: 'oneplus-nord-ce-6-lite-8-128', name: '8GB + 128GB', basePrice: 18600 },
            { id: 'oneplus-nord-ce-6-lite-8-256', name: '8GB + 256GB', basePrice: 20100 },
        ]
    },
    {
        id: 'oneplus-15r',
        brandId: 'oneplus',
        name: 'OnePlus 15R',
        img: '/models/oneplus/Oneplus_15R.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'oneplus-15r-12-256', name: '12GB + 256GB', basePrice: 35600 },
            { id: 'oneplus-15r-16-512', name: '16GB + 512GB', basePrice: 37500 },
        ]
    },

    // -------------------------------------------------------------
    // Vivo (26 Models)
    // -------------------------------------------------------------
    {
        id: 'vivo-x300-ultra',
        brandId: 'vivo',
        name: 'Vivo X300 Ultra',
        img: '/models/vivo/Vivo_X300_Pro.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-x300-ultra-12-256', name: '12GB + 256GB', basePrice: 56100 },
            { id: 'vivo-x300-ultra-16-512', name: '16GB + 512GB', basePrice: 60000 },
        ]
    },
    {
        id: 'vivo-x300-pro-5g',
        brandId: 'vivo',
        name: 'Vivo X300 Pro 5G',
        img: '/models/vivo/Vivo_X300_Pro.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-x300-pro-5g-12-256', name: '12GB + 256GB', basePrice: 48000 },
            { id: 'vivo-x300-pro-5g-16-512', name: '16GB + 512GB', basePrice: 63600 },
        ]
    },
    {
        id: 'vivo-x300-5g',
        brandId: 'vivo',
        name: 'Vivo X300 5G',
        img: '/models/vivo/Vivo_X300.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-x300-5g-8-256', name: '8GB + 256GB', basePrice: 36465 },
            { id: 'vivo-x300-5g-12-256', name: '12GB + 256GB', basePrice: 39000 },
        ]
    },
    {
        id: 'vivo-x300-fe-5g',
        brandId: 'vivo',
        name: 'Vivo X300 FE 5G',
        img: '/models/vivo/Vivo_X200_FE.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-x300-fe-5g-12-256', name: '12GB + 256GB', basePrice: 49800 },
            { id: 'vivo-x300-fe-5g-12-512', name: '12GB + 512GB', basePrice: 54800 },
        ]
    },
    {
        id: 'vivo-x300-fe-ultra',
        brandId: 'vivo',
        name: 'Vivo X300 FE Ultra',
        img: '/models/vivo/Vivo_X300_Pro.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-x300-fe-ultra-16-512', name: '16GB + 512GB', basePrice: 80000 },
        ]
    },
    {
        id: 'vivo-x800',
        brandId: 'vivo',
        name: 'Vivo X800',
        img: '/models/vivo/Vivo_X300_Pro.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-x800-12-256', name: '12GB + 256GB', basePrice: 46800 },
            { id: 'vivo-x800-12-512', name: '12GB + 512GB', basePrice: 47400 },
            { id: 'vivo-x800-16-512', name: '16GB + 512GB', basePrice: 50000 },
        ]
    },
    {
        id: 'vivo-x200t',
        brandId: 'vivo',
        name: 'Vivo X200T',
        img: '/models/vivo/Vivo_X200T.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-x200t-12-256', name: '12GB + 256GB', basePrice: 38100 },
            { id: 'vivo-x200t-12-512', name: '12GB + 512GB', basePrice: 42200 },
        ]
    },
    {
        id: 'vivo-x200-pro',
        brandId: 'vivo',
        name: 'Vivo X200 Pro',
        img: '/models/vivo/Vivo_X200_Pro_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-x200-pro-12-256', name: '12GB + 256GB', basePrice: 39270 },
            { id: 'vivo-x200-pro-12-512', name: '12GB + 512GB', basePrice: 42000 },
        ]
    },
    {
        id: 'vivo-v70-5g',
        brandId: 'vivo',
        name: 'Vivo V70 5G',
        img: '/models/vivo/Vivo_V60_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-v70-5g-8-256', name: '8GB + 256GB', basePrice: 33200 },
            { id: 'vivo-v70-5g-12-256', name: '12GB + 256GB', basePrice: 36000 },
        ]
    },
    {
        id: 'vivo-v70-elite',
        brandId: 'vivo',
        name: 'Vivo V70 Elite',
        img: '/models/vivo/Vivo_V60_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-v70-elite-8-256', name: '8GB + 256GB', basePrice: 36000 },
            { id: 'vivo-v70-elite-12-256', name: '12GB + 256GB', basePrice: 39100 },
            { id: 'vivo-v70-elite-12-512', name: '12GB + 512GB', basePrice: 41700 },
        ]
    },
    {
        id: 'vivo-v70-fe',
        brandId: 'vivo',
        name: 'Vivo V70 FE',
        img: '/models/vivo/Vivo_V50_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-v70-fe-8-128', name: '8GB + 128GB', basePrice: 24500 },
            { id: 'vivo-v70-fe-8-256', name: '8GB + 256GB', basePrice: 26800 },
            { id: 'vivo-v70-fe-12-256', name: '12GB + 256GB', basePrice: 30100 },
        ]
    },
    {
        id: 'vivo-v60-5g',
        brandId: 'vivo',
        name: 'Vivo V60 5G',
        img: '/models/vivo/Vivo_V60_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-v60-5g-8-128', name: '8GB + 128GB', basePrice: 17952 },
            { id: 'vivo-v60-5g-8-256', name: '8GB + 256GB', basePrice: 19000 },
        ]
    },
    {
        id: 'vivo-v60e-5g',
        brandId: 'vivo',
        name: 'Vivo V60e 5G',
        img: '/models/vivo/Vivo_V60e.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-v60e-5g-8-128', name: '8GB + 128GB', basePrice: 14586 },
            { id: 'vivo-v60e-5g-8-256', name: '8GB + 256GB', basePrice: 15500 },
        ]
    },
    {
        id: 'vivo-t50-pro-5g',
        brandId: 'vivo',
        name: 'Vivo T50 Pro 5G',
        img: '/models/vivo/Vivo_T4_Pro_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-t50-pro-5g-8-128', name: '8GB + 128GB', basePrice: 14025 },
            { id: 'vivo-t50-pro-5g-8-256', name: '8GB + 256GB', basePrice: 15000 },
        ]
    },
    {
        id: 'vivo-t5x-5g',
        brandId: 'vivo',
        name: 'Vivo T5x 5G',
        img: '/models/vivo/Vivo_T4x_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-t5x-5g-6-128', name: '6GB + 128GB', basePrice: 15300 },
            { id: 'vivo-t5x-5g-8-128', name: '8GB + 128GB', basePrice: 18200 },
            { id: 'vivo-t5x-5g-8-256', name: '8GB + 256GB', basePrice: 19000 },
        ]
    },
    {
        id: 'vivo-t5-lite-5g',
        brandId: 'vivo',
        name: 'Vivo T5 Lite 5G',
        img: '/models/vivo/Vivo_T4_Lite_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-t5-lite-5g-4-128', name: '4GB + 128GB', basePrice: 7854 },
            { id: 'vivo-t5-lite-5g-6-128', name: '6GB + 128GB', basePrice: 8500 },
        ]
    },
    {
        id: 'vivo-t5e',
        brandId: 'vivo',
        name: 'Vivo T5e',
        img: '/models/vivo/Vivo_T4_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-t5e-6-128', name: '6GB + 128GB', basePrice: 11220 },
            { id: 'vivo-t5e-8-128', name: '8GB + 128GB', basePrice: 12000 },
        ]
    },
    {
        id: 'vivo-s2-5g',
        brandId: 'vivo',
        name: 'Vivo S2 5G',
        img: '/models/vivo/Vivo_S1_Pro.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-s2-5g-8-256', name: '8GB + 256GB', basePrice: 18513 },
            { id: 'vivo-s2-5g-12-256', name: '12GB + 256GB', basePrice: 19800 },
        ]
    },
    {
        id: 'vivo-s50-mini',
        brandId: 'vivo',
        name: 'Vivo S50 / Mini',
        img: '/models/vivo/Vivo_S1.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-s50-mini-8-128', name: '8GB + 128GB', basePrice: 15708 },
            { id: 'vivo-s50-mini-8-256', name: '8GB + 256GB', basePrice: 16800 },
        ]
    },
    {
        id: 'vivo-y51-pro-5g',
        brandId: 'vivo',
        name: 'Vivo Y51 Pro 5G',
        img: '/models/vivo/Vivo_Y51A.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-y51-pro-5g-8-128', name: '8GB + 128GB', basePrice: 17700 },
            { id: 'vivo-y51-pro-5g-8-256', name: '8GB + 256GB', basePrice: 20100 },
        ]
    },
    {
        id: 'vivo-y81-5g',
        brandId: 'vivo',
        name: 'Vivo Y81 5G',
        img: '/models/vivo/Vivo_Y81.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-y81-5g-4-128', name: '4GB + 128GB', basePrice: 13500 },
            { id: 'vivo-y81-5g-6-128', name: '6GB + 128GB', basePrice: 14400 },
            { id: 'vivo-y81-5g-8-128', name: '8GB + 128GB', basePrice: 16100 },
        ]
    },
    {
        id: 'vivo-y11-5g',
        brandId: 'vivo',
        name: 'Vivo Y11 5G',
        img: '/models/vivo/Vivo_Y11_2019.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-y11-5g-4-64', name: '4GB + 64GB', basePrice: 10100 },
            { id: 'vivo-y11-5g-4-128', name: '4GB + 128GB', basePrice: 11600 },
        ]
    },
    {
        id: 'vivo-y05',
        brandId: 'vivo',
        name: 'Vivo Y05',
        img: '/models/vivo/Vivo_Y01.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-y05-4-64', name: '4GB + 64GB', basePrice: 10000 },
        ]
    },
    {
        id: 'vivo-y600-pro',
        brandId: 'vivo',
        name: 'Vivo Y600 Pro',
        img: '/models/vivo/Vivo_Y400_Pro_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-y600-pro-8-128', name: '8GB + 128GB', basePrice: 12342 },
            { id: 'vivo-y600-pro-8-256', name: '8GB + 256GB', basePrice: 13500 },
        ]
    },
    {
        id: 'vivo-y500-pro',
        brandId: 'vivo',
        name: 'Vivo Y500 Pro',
        img: '/models/vivo/Vivo_Y400_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-y500-pro-6-128', name: '6GB + 128GB', basePrice: 10098 },
            { id: 'vivo-y500-pro-8-128', name: '8GB + 128GB', basePrice: 11000 },
        ]
    },
    {
        id: 'vivo-y500-5g',
        brandId: 'vivo',
        name: 'Vivo Y500 5G',
        img: '/models/vivo/Vivo_Y300_5G.png',
        category: 'smartphone',
        priority: 10,
        variants: [
            { id: 'vivo-y500-5g-6-128', name: '6GB + 128GB', basePrice: 8415 },
            { id: 'vivo-y500-5g-8-128', name: '8GB + 128GB', basePrice: 9000 },
        ]
    }
];

export function get2026ModelsForBrand(brandId?: string, category?: string) {
    return CATALOG_2026_MODELS.filter(m => {
        if (brandId && m.brandId !== brandId) return false;
        if (category && category !== 'smartphone' && category !== 'mobile') return false;
        return true;
    });
}

export function getCanonicalModelKey(name: string): string {
    if (!name) return '';
    return name
        .toLowerCase()
        .replace(/\b5g\b/gi, '')
        .replace(/\b4g\b/gi, '')
        .replace(/\b3g\b/gi, '')
        .replace(/\+/g, 'plus')
        .replace(/\b(samsung|galaxy|vivo|xiaomi|redmi|realme|poco|apple|iphone|oppo|oneplus|iqoo|motorola|google|pixel)\b/gi, '')
        .replace(/[^a-z0-9]/gi, '')
        .trim();
}

/** Redmi and POCO are Xiaomi sub-brands: their models may be filed under any of these brand ids. */
const BRAND_FAMILY: Record<string, string> = { redmi: 'xiaomi', poco: 'xiaomi', mi: 'xiaomi' };

export function brandFamily(brandId?: string | null): string {
    const b = (brandId || '').toLowerCase().trim();
    return BRAND_FAMILY[b] || b;
}

/**
 * Brand family + canonical name. The canonical name alone drops brand words ("iPhone 14" and "Realme 14" both become
 * "14"), so models are only matched or merged within the same brand (models without a brand among themselves).
 */
export function getModelIdentityKey(brandId: string | null | undefined, name: string): string {
    const key = getCanonicalModelKey(name);
    return key ? `${brandFamily(brandId)}|${key}` : '';
}

export const BRAND_DEFAULT_IMAGES: Record<string, string> = {
    samsung: '/models/samsung/Samsung_Galaxy_S25_Ultra.png',
    xiaomi: '/models/xiaomi/Xiaomi_15.png',
    realme: '/models/realme/Realme_GT_7_Pro_5G.png',
    poco: '/models/poco/Poco_F7.png',
    vivo: '/models/vivo/Vivo_X300_Pro.png',
    apple: 'https://fdn2.gsmarena.com/vv/bigpic/apple-iphone-14.jpg',
    oneplus: '/models/oneplus/Oneplus_15R.png',
    iqoo: '/models/vivo/Vivo_X300_Pro.png',
    oppo: '/models/realme/Realme_GT_6.png',
    motorola: '/models/xiaomi/Xiaomi_15.png',
    google: '/models/samsung/Samsung_Galaxy_S25_Ultra.png',
};

export function resolveModelImage(brandId: string, modelName: string, currentImg?: string): string {
    const cleanBrand = (brandId || '').toLowerCase().trim();
    const cleanName = (modelName || '').toLowerCase().trim();
    const cKey = getCanonicalModelKey(modelName);

    // 1. Check 2026 Catalog first for the most accurate dedicated product render — of the same brand: "iPhone 14"
    // must not get the "Realme 14" picture. A model without a brand may match any brand, as before.
    const family = brandFamily(cleanBrand);
    const catalogMatch = CATALOG_2026_MODELS.find(
        m => (!family || brandFamily(m.brandId) === family)
            && (m.name.toLowerCase().trim() === cleanName || getCanonicalModelKey(m.name) === cKey)
    );
    if (catalogMatch && catalogMatch.img) {
        return catalogMatch.img;
    }

    // 2. If currentImg is a valid non-empty device photo (not SVG, not Wikimedia logo, not generic placeholder)
    if (
        currentImg &&
        currentImg.trim().length > 0 &&
        !currentImg.endsWith('.svg') &&
        !currentImg.includes('.svg') &&
        !currentImg.includes('wikimedia') &&
        !currentImg.includes('Wikipedia') &&
        !currentImg.includes('Logo') &&
        !currentImg.includes('logo.png')
    ) {
        return currentImg;
    }

    // 3. Fallback to Brand default flagship device render so no model is ever blank
    return BRAND_DEFAULT_IMAGES[cleanBrand] || '/models/samsung/Samsung_Galaxy_S25_Ultra.png';
}

export function deduplicateModels<T extends { name: string; priority?: number; img?: string; brandId?: string }>(models: T[]): T[] {
    const seen = new Map<string, T>();
    for (const rawModel of models) {
        // Resolve img so it is guaranteed never empty or SVG
        const resolvedImg = resolveModelImage(rawModel.brandId || '', rawModel.name, rawModel.img);
        const model = { ...rawModel, img: resolvedImg };

        // Same model of the same brand only: "iPhone 14 Pro" and "Realme 14 Pro" are different phones.
        const key = getModelIdentityKey(model.brandId, model.name);
        if (!key) {
            seen.set(model.name, model);
            continue;
        }

        const existing = seen.get(key);
        if (!existing) {
            seen.set(key, model);
        } else {
            // Keep the one with higher priority (lower priority number, e.g. 10 < 100)
            const pExisting = existing.priority ?? 100;
            const pModel = model.priority ?? 100;

            if (pModel < pExisting) {
                seen.set(key, model);
            } else if (pModel === pExisting) {
                // If same priority, prefer the name containing '5G' or more descriptive name
                if (model.name.toLowerCase().includes('5g') && !existing.name.toLowerCase().includes('5g')) {
                    seen.set(key, model);
                }
            }
        }
    }
    return Array.from(seen.values());
}
