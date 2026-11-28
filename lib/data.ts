
export const brands = [
    { id: 'apple', name: 'Apple', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg', categories: ['smartphone', 'tablet', 'watch'] },
    { id: 'xiaomi', name: 'Xiaomi', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Xiaomi_logo_%282021-%29.svg', categories: ['smartphone', 'tablet', 'tv', 'watch'] },
    { id: 'samsung', name: 'Samsung', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg', categories: ['smartphone', 'tablet', 'watch', 'tv'] },
    { id: 'vivo', name: 'Vivo', logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Vivo_logo_2019.svg', categories: ['smartphone'] },
    { id: 'oneplus', name: 'OnePlus', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f8/OnePlus_logo.svg', categories: ['smartphone', 'tablet', 'watch'] },
    { id: 'oppo', name: 'Oppo', logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/OPPO_Logo.svg', categories: ['smartphone'] },
    { id: 'realme', name: 'Realme', logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Realme-realme-_logo_box_RGB_01.svg', categories: ['smartphone', 'tablet'] },
    { id: 'motorola', name: 'Motorola', logo: 'https://upload.wikimedia.org/wikipedia/commons/4/43/Motorola_logo.svg', categories: ['smartphone'] },
    { id: 'lenovo', name: 'Lenovo', logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Lenovo_logo_2015.svg', categories: ['smartphone', 'tablet'] },
    { id: 'nokia', name: 'Nokia', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c0/Nokia_logoblue.svg', categories: ['smartphone'] },
    { id: 'honor', name: 'Honor', logo: 'https://upload.wikimedia.org/wikipedia/commons/8/80/Honor_Logo.svg', categories: ['smartphone'] },
    { id: 'google', name: 'Google', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg', categories: ['smartphone', 'watch', 'tablet'] },
    { id: 'poco', name: 'Poco', logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Poco_Logo.svg', categories: ['smartphone'] },
    { id: 'infinix', name: 'Infinix', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c2/Infinix_Mobility_logo.svg', categories: ['smartphone'] },
    { id: 'tecno', name: 'Tecno', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Tecno_Mobile_logo.svg', categories: ['smartphone'] },
    { id: 'iqoo', name: 'iQOO', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/IQOO_logo.svg', categories: ['smartphone'] },
    { id: 'nothing', name: 'Nothing', logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e6/Nothing_Technology_logo.svg', categories: ['smartphone'] },
    { id: 'sony', name: 'Sony', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Sony_logo.svg', categories: ['smartphone', 'tv', 'console'] },
    { id: 'lg', name: 'LG', logo: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/LG_logo_%282015%29.svg', categories: ['smartphone', 'tv'] },
    { id: 'microsoft', name: 'Microsoft', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg', categories: ['console', 'tablet'] },
    { id: 'nintendo', name: 'Nintendo', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/0d/Nintendo.svg', categories: ['console'] },
];

export const models = {
    'xiaomi': [
        { id: 'redmi-turbo-5', brandId: 'xiaomi', name: 'Redmi Turbo 5', img: '/models/xiaomi/Xiaomi_15.png', category: 'smartphone', priority: 10 },
        { id: 'redmi-note-15-pro-plus-5g', brandId: 'xiaomi', name: 'Redmi Note 15 Pro+ 5G', img: '/models/xiaomi/Redmi_Note_15_Pro_Plus_5G.png', category: 'smartphone', priority: 10 },
        { id: 'redmi-note-15-pro-5g', brandId: 'xiaomi', name: 'Redmi Note 15 Pro 5G', img: '/models/xiaomi/Redmi_Note_15_Pro_5G.png', category: 'smartphone', priority: 10 },
        { id: 'redmi-note-15-5g', brandId: 'xiaomi', name: 'Redmi Note 15 5G', img: '/models/xiaomi/Redmi_Note_15_5G.png', category: 'smartphone', priority: 10 },
        { id: 'redmi-note-15-se-5g', brandId: 'xiaomi', name: 'Redmi Note 15 SE 5G', img: '/models/xiaomi/Redmi_Note_14_SE_5G.png', category: 'smartphone', priority: 10 },
        { id: 'redmi-note-17-5g', brandId: 'xiaomi', name: 'Redmi Note 17 5G', img: '/models/xiaomi/Redmi_Note_14_5G.png', category: 'smartphone', priority: 10 },
        { id: 'redmi-15c-5g', brandId: 'xiaomi', name: 'Redmi 15C 5G', img: '/models/xiaomi/Redmi_15C_5G.png', category: 'smartphone', priority: 10 },
        { id: 'redmi-15a-5g', brandId: 'xiaomi', name: 'Redmi 15A 5G', img: '/models/xiaomi/Redmi_15_5G.png', category: 'smartphone', priority: 10 },
        { id: 'redmi-note-6-pro', brandId: 'xiaomi', name: 'Redmi Note 6 Pro', img: 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-redmi-note-6-pro.jpg', category: 'smartphone' },
        { id: 'redmi-note-10', brandId: 'xiaomi', name: 'Redmi Note 10', img: 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-redmi-note10.jpg', category: 'smartphone' },
        { id: 'mi-11x', brandId: 'xiaomi', name: 'Mi 11X', img: 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-mi11x.jpg', category: 'smartphone' },
        { id: 'mi-tv-4a', brandId: 'xiaomi', name: 'Mi TV 4A 32"', img: 'https://i01.appmifile.com/v1/MIBC/s/width/1000/height/1000/priority/1/2dd6fc82390a3de077b966cf13a96739.jpg', category: 'tv' },
    ],
    'apple': [
        { id: 'iphone-13', brandId: 'apple', name: 'iPhone 13', img: 'https://fdn2.gsmarena.com/vv/bigpic/apple-iphone-13.jpg', category: 'smartphone' },
        { id: 'iphone-14', brandId: 'apple', name: 'iPhone 14', img: 'https://fdn2.gsmarena.com/vv/bigpic/apple-iphone-14.jpg', category: 'smartphone' },
        { id: 'ipad-pro', brandId: 'apple', name: 'iPad Pro 11"', img: 'https://fdn2.gsmarena.com/vv/bigpic/apple-ipad-pro-11-2022.jpg', category: 'tablet' },
        { id: 'watch-s8', brandId: 'apple', name: 'Watch Series 8', img: 'https://fdn2.gsmarena.com/vv/bigpic/apple-watch-series8-45mm.jpg', category: 'watch' },
    ],
    'samsung': [
        { id: 'galaxy-s26-ultra-5g', brandId: 'samsung', name: 'Galaxy S26 Ultra 5G', img: '/models/samsung/Samsung_Galaxy_S25_Ultra.png', category: 'smartphone', priority: 10 },
        { id: 'galaxy-s26-plus-5g', brandId: 'samsung', name: 'Galaxy S26+ 5G', img: '/models/samsung/Samsung_Galaxy_S25_Plus.png', category: 'smartphone', priority: 10 },
        { id: 'galaxy-s26-5g', brandId: 'samsung', name: 'Galaxy S26 5G', img: '/models/samsung/Samsung_Galaxy_S25.png', category: 'smartphone', priority: 10 },
        { id: 'galaxy-z-fold-8-ultra', brandId: 'samsung', name: 'Galaxy Z Fold 8 Ultra', img: '/models/samsung/Samsung_Galaxy_Z_Fold_7.png', category: 'smartphone', priority: 10 },
        { id: 'galaxy-z-fold-8', brandId: 'samsung', name: 'Galaxy Z Fold 8', img: '/models/samsung/Samsung_Galaxy_Z_Fold_6.png', category: 'smartphone', priority: 10 },
        { id: 'galaxy-z-flip-8', brandId: 'samsung', name: 'Galaxy Z Flip 8', img: '/models/samsung/Samsung_Galaxy_Z_Flip_7.png', category: 'smartphone', priority: 10 },
        { id: 'galaxy-f70-pro-5g', brandId: 'samsung', name: 'Galaxy F70 Pro 5G', img: '/models/samsung/Samsung_Galaxy_F56_5G.png', category: 'smartphone', priority: 10 },
        { id: 'galaxy-m47-5g', brandId: 'samsung', name: 'Galaxy M47 5G', img: '/models/samsung/Samsung_Galaxy_M56_5G.png', category: 'smartphone', priority: 10 },
        { id: 'galaxy-a86-5g', brandId: 'samsung', name: 'Galaxy A86 5G', img: '/models/samsung/Samsung_Galaxy_A56_5G.png', category: 'smartphone', priority: 10 },
        { id: 'galaxy-s21', brandId: 'samsung', name: 'Galaxy S21', img: 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-s21-5g-r.jpg', category: 'smartphone' },
        { id: 'galaxy-tab-s8', brandId: 'samsung', name: 'Galaxy Tab S8', img: 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-tab-s8.jpg', category: 'tablet' },
        { id: 'galaxy-watch-5', brandId: 'samsung', name: 'Galaxy Watch 5', img: 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-watch5-44mm.jpg', category: 'watch' },
        { id: 'samsung-tv-qled', brandId: 'samsung', name: 'QLED 4K Smart TV', img: 'https://images.samsung.com/is/image/samsung/p6pim/in/qa55qn90baklxl/gallery/in-neo-qled-qn90b-qa55qn90baklxl-531393673?$684_684_PNG$', category: 'tv' },
    ],
    'sony': [
        { id: 'ps5', brandId: 'sony', name: 'PlayStation 5', img: 'https://gmedia.playstation.com/is/image/SIEPDC/ps5-product-thumbnail-01-en-14sep21?$facebook$', category: 'console' },
        { id: 'sony-bravia', brandId: 'sony', name: 'BRAVIA XR OLED', img: 'https://www.sony.co.in/image/5dca43e49661b177d5492429672d6228?fmt=pjpeg&wid=330&bgcolor=FFFFFF&bgc=FFFFFF', category: 'tv' },
    ],
    'microsoft': [
        { id: 'xbox-series-x', brandId: 'microsoft', name: 'Xbox Series X', img: 'https://cms-assets.xboxservices.com/assets/0b/40/0b402283-0663-4bd0-830b-ca97042c13f6.png?n=Xbox-Series-X_Image-0_Console_281x378.png', category: 'console' },
    ],
    'nintendo': [
        { id: 'switch-oled', brandId: 'nintendo', name: 'Nintendo Switch OLED', img: 'https://assets.nintendo.com/image/upload/f_auto/q_auto/dpr_1.5/c_scale,w_400/ncom/en_US/switch/site-design-update/hardware/switch/oled-model/gallery/white/01', category: 'console' },
    ],
    'lg': [
        { id: 'lg-oled-c2', brandId: 'lg', name: 'LG OLED C2', img: 'https://www.lg.com/in/images/tvs/md07554868/gallery/OLED55C2PSC-D-01.jpg', category: 'tv' },
    ],
    'oneplus': [
        { id: 'oneplus-n6', brandId: 'oneplus', name: 'OnePlus N6', img: '/models/oneplus/OnePlus_Nord_N20_SE.png', category: 'smartphone', priority: 10 },
        { id: 'oneplus-nord-ce-6-5g', brandId: 'oneplus', name: 'OnePlus Nord CE 6 5G', img: '/models/oneplus/OnePlus_Nord_CE_5_5G.png', category: 'smartphone', priority: 10 },
        { id: 'oneplus-nord-ce-6-lite', brandId: 'oneplus', name: 'OnePlus Nord CE 6 Lite', img: '/models/oneplus/OnePlus_Nord_CE4_Lite_5G.png', category: 'smartphone', priority: 10 },
        { id: 'oneplus-15r', brandId: 'oneplus', name: 'OnePlus 15R', img: '/models/oneplus/Oneplus_15R.png', category: 'smartphone', priority: 10 },
        { id: 'op-10', brandId: 'oneplus', name: 'OnePlus 10 Pro', img: '/models/oneplus/OnePlus_10_Pro_5G.png', category: 'smartphone' },
    ],
    'vivo': [
        { id: 'vivo-x300-ultra', brandId: 'vivo', name: 'Vivo X300 Ultra', img: '/models/vivo/Vivo_X300_Pro.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-x300-pro-5g', brandId: 'vivo', name: 'Vivo X300 Pro 5G', img: '/models/vivo/Vivo_X300_Pro.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-x300-5g', brandId: 'vivo', name: 'Vivo X300 5G', img: '/models/vivo/Vivo_X300.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-x300-fe-5g', brandId: 'vivo', name: 'Vivo X300 FE 5G', img: '/models/vivo/Vivo_X200_FE.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-x300-fe-ultra', brandId: 'vivo', name: 'Vivo X300 FE Ultra', img: '/models/vivo/Vivo_X300_Pro.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-x800', brandId: 'vivo', name: 'Vivo X800', img: '/models/vivo/Vivo_X300_Pro.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-x200t', brandId: 'vivo', name: 'Vivo X200T', img: '/models/vivo/Vivo_X200T.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-x200-pro', brandId: 'vivo', name: 'Vivo X200 Pro', img: '/models/vivo/Vivo_X200_Pro_5G.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-v70-5g', brandId: 'vivo', name: 'Vivo V70 5G', img: '/models/vivo/Vivo_V60_5G.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-v70-elite', brandId: 'vivo', name: 'Vivo V70 Elite', img: '/models/vivo/Vivo_V60_5G.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-v70-fe', brandId: 'vivo', name: 'Vivo V70 FE', img: '/models/vivo/Vivo_V50_5G.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-v60-5g', brandId: 'vivo', name: 'Vivo V60 5G', img: '/models/vivo/Vivo_V60_5G.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-v60e-5g', brandId: 'vivo', name: 'Vivo V60e 5G', img: '/models/vivo/Vivo_V60e.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-t50-pro-5g', brandId: 'vivo', name: 'Vivo T50 Pro 5G', img: '/models/vivo/Vivo_T4_Pro_5G.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-t5x-5g', brandId: 'vivo', name: 'Vivo T5x 5G', img: '/models/vivo/Vivo_T4x_5G.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-t5-lite-5g', brandId: 'vivo', name: 'Vivo T5 Lite 5G', img: '/models/vivo/Vivo_T4_Lite_5G.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-t5e', brandId: 'vivo', name: 'Vivo T5e', img: '/models/vivo/Vivo_T4_5G.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-s2-5g', brandId: 'vivo', name: 'Vivo S2 5G', img: '/models/vivo/Vivo_S1_Pro.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-s50-mini', brandId: 'vivo', name: 'Vivo S50 / Mini', img: '/models/vivo/Vivo_S1.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-y51-pro-5g', brandId: 'vivo', name: 'Vivo Y51 Pro 5G', img: '/models/vivo/Vivo_Y51A.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-y81-5g', brandId: 'vivo', name: 'Vivo Y81 5G', img: '/models/vivo/Vivo_Y81.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-y11-5g', brandId: 'vivo', name: 'Vivo Y11 5G', img: '/models/vivo/Vivo_Y11_2019.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-y05', brandId: 'vivo', name: 'Vivo Y05', img: '/models/vivo/Vivo_Y01.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-y600-pro', brandId: 'vivo', name: 'Vivo Y600 Pro', img: '/models/vivo/Vivo_Y400_Pro_5G.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-y500-pro', brandId: 'vivo', name: 'Vivo Y500 Pro', img: '/models/vivo/Vivo_Y400_5G.png', category: 'smartphone', priority: 10 },
        { id: 'vivo-y500-5g', brandId: 'vivo', name: 'Vivo Y500 5G', img: '/models/vivo/Vivo_Y300_5G.png', category: 'smartphone', priority: 10 }
    ],
    'oppo': [],
    'realme': [
        { id: 'realme-gt6-pro-5g', brandId: 'realme', name: 'Realme GT6 Pro 5G', img: '/models/realme/Realme_GT_7_Pro_5G.png', category: 'smartphone', priority: 10 },
        { id: 'realme-gt6-5g', brandId: 'realme', name: 'Realme GT6 5G', img: '/models/realme/Realme_GT_6.png', category: 'smartphone', priority: 10 },
        { id: 'realme-gt-neo-8-5g', brandId: 'realme', name: 'Realme GT Neo 8 5G', img: '/models/realme/REALME_GT_NEO_3_150W.png', category: 'smartphone', priority: 10 },
        { id: 'realme-14-pro-plus-5g', brandId: 'realme', name: 'Realme 14 Pro+ 5G', img: '/models/realme/Realme_14_Pro_Plus_5G.png', category: 'smartphone', priority: 10 },
        { id: 'realme-14-pro-5g', brandId: 'realme', name: 'Realme 14 Pro 5G', img: '/models/realme/Realme_14_Pro_5G.png', category: 'smartphone', priority: 10 },
        { id: 'realme-14-5g', brandId: 'realme', name: 'Realme 14 5G', img: '/models/realme/Realme_14X_5G.png', category: 'smartphone', priority: 10 },
        { id: 'realme-narzo-80-pro', brandId: 'realme', name: 'Realme Narzo 80 Pro', img: '/models/realme/Realme_Narzo_80_Pro_5G.png', category: 'smartphone', priority: 10 },
        { id: 'realme-narzo-80x-5g', brandId: 'realme', name: 'Realme Narzo 80x 5G', img: '/models/realme/Realme_Narzo_80X_5G.png', category: 'smartphone', priority: 10 },
        { id: 'realme-c75-5g', brandId: 'realme', name: 'Realme C75 5G', img: '/models/realme/Realme_C75_5G.png', category: 'smartphone', priority: 10 }
    ],
    'google': [],
    'motorola': [],
    'nothing': [],
    'lenovo': [],
    'nokia': [],
    'honor': [],
    'poco': [
        { id: 'poco-f8-pro-5g', brandId: 'poco', name: 'POCO F8 Pro 5G', img: '/models/poco/Poco_F7.png', category: 'smartphone', priority: 10 },
        { id: 'poco-f8-5g', brandId: 'poco', name: 'POCO F8 5G', img: '/models/poco/Poco_F6_5G.png', category: 'smartphone', priority: 10 },
        { id: 'poco-f8-gt-5g', brandId: 'poco', name: 'POCO F8 GT 5G', img: '/models/poco/POCO_F3_GT.png', category: 'smartphone', priority: 10 },
        { id: 'poco-x8-pro-5g', brandId: 'poco', name: 'POCO X8 Pro 5G', img: '/models/poco/Poco_X7_Pro_5G.png', category: 'smartphone', priority: 10 },
        { id: 'poco-x8-5g', brandId: 'poco', name: 'POCO X8 5G', img: '/models/poco/Poco_X7_5G.png', category: 'smartphone', priority: 10 },
        { id: 'poco-x8-neo-5g', brandId: 'poco', name: 'POCO X8 Neo 5G', img: '/models/poco/Poco_X6_Neo.png', category: 'smartphone', priority: 10 },
        { id: 'poco-m8-pro-5g', brandId: 'poco', name: 'POCO M8 Pro 5G', img: '/models/poco/Poco_M7_Pro_5G.png', category: 'smartphone', priority: 10 },
        { id: 'poco-m8-5g', brandId: 'poco', name: 'POCO M8 5G', img: '/models/poco/Poco_M8_5G.png', category: 'smartphone', priority: 10 },
        { id: 'poco-c8-5g', brandId: 'poco', name: 'POCO C8 5G', img: '/models/poco/Poco_C75_5G.png', category: 'smartphone', priority: 10 },
        { id: 'poco-c8-plus', brandId: 'poco', name: 'POCO C8 Plus', img: '/models/poco/POCO_C85.png', category: 'smartphone', priority: 10 }
    ],
    'iqoo': [],
    'infinix': [],
    'tecno': [],
    // Add others as needed
};

// Categories of variants to select from
export const variantSets = {
    'smartphone': [
        { id: '4-64', name: '4 GB / 64 GB', basePrice: 5000 },
        { id: '6-64', name: '6 GB / 64 GB', basePrice: 6500 },
        { id: '6-128', name: '6 GB / 128 GB', basePrice: 8000 },
        { id: '8-128', name: '8 GB / 128 GB', basePrice: 10000 },
        { id: '8-256', name: '8 GB / 256 GB', basePrice: 12000 },
        { id: '12-256', name: '12 GB / 256 GB', basePrice: 15000 },
    ],
    'tablet': [
        { id: 'wifi-64', name: 'WiFi Only - 64 GB', basePrice: 15000 },
        { id: 'wifi-128', name: 'WiFi Only - 128 GB', basePrice: 20000 },
        { id: 'wifi-256', name: 'WiFi Only - 256 GB', basePrice: 25000 },
        { id: 'cell-64', name: 'WiFi + Cellular - 64 GB', basePrice: 20000 },
        { id: 'cell-128', name: 'WiFi + Cellular - 128 GB', basePrice: 25000 },
    ],
    'watch': [
        { id: 'gps-40', name: 'GPS - 40mm', basePrice: 10000 },
        { id: 'gps-44', name: 'GPS - 44mm', basePrice: 12000 },
        { id: 'lte-40', name: 'GPS + Cellular - 40mm', basePrice: 15000 },
        { id: 'lte-44', name: 'GPS + Cellular - 44mm', basePrice: 18000 },
    ],
    'console': [
        { id: 'dig', name: 'Digital Edition', basePrice: 15000 },
        { id: 'disc', name: 'Disc Edition', basePrice: 20000 },
        { id: '500gb', name: '500 GB Storage', basePrice: 10000 },
        { id: '1tb', name: '1 TB Storage', basePrice: 12000 },
    ],
    'tv': [
        { id: '32', name: '32 inch', basePrice: 5000 },
        { id: '43', name: '43 inch', basePrice: 10000 },
        { id: '50', name: '50 inch', basePrice: 15000 },
        { id: '55', name: '55 inch', basePrice: 20000 },
        { id: '65', name: '65 inch', basePrice: 30000 },
    ],
    'desktop': [
        { id: 'i3-8-500', name: 'Core i3 / 8GB / 500GB', basePrice: 8000 },
        { id: 'i5-16-1tb', name: 'Core i5 / 16GB / 1TB', basePrice: 15000 },
        { id: 'i7-32-2tb', name: 'Core i7 / 32GB / 2TB', basePrice: 25000 },
        { id: 'mac-mini', name: 'Mac Mini (Base)', basePrice: 20000 },
        { id: 'imac', name: 'iMac 24"', basePrice: 40000 },
    ],
    'earbuds': [
        { id: 'base', name: 'Standard Version', basePrice: 2000 },
        { id: 'pro', name: 'Pro / Noise Cancelling', basePrice: 5000 },
    ]
};

// Default export for backward compatibility if needed, but we should rely on variantSets
export const variants = variantSets.smartphone;

export const questionnaireSteps = {
    'smartphone': [
        {
            id: 'physical_condition',
            title: 'Tell us more about your device questions',
            subtitle: 'Select screen\'s physical condition',
            type: 'single-select',
            options: [
                { id: 'flawless', label: 'Flawless', description: 'No signs of usage', icon: 'Sparkles' },
                { id: 'good', label: 'Good', description: 'Minor scratches', icon: 'Smile' },
                { id: 'average', label: 'Average', description: 'Major scratches', icon: 'MinusCircle' },
                { id: 'below_average', label: 'Below Average', description: 'Screen crack, Dead pixel, Lines on screen', icon: 'AlertTriangle' },
            ]
        },
        {
            id: 'body_condition',
            title: 'Body Condition',
            subtitle: 'Select the condition of the device body (back panel/frame)',
            type: 'single-select',
            options: [
                { id: 'flawless', label: 'Flawless', description: 'No scratches or dents', icon: 'Sparkles' },
                { id: 'good', label: 'Good', description: 'Minor scratches, no dents', icon: 'Smile' },
                { id: 'average', label: 'Average', description: 'Visible scratches and minor dents', icon: 'MinusCircle' },
                { id: 'below_average', label: 'Below Average', description: 'Heavy dents, cracks, or bent frame', icon: 'AlertTriangle' },
            ]
        },
        {
            // Only folding phones (showFor: the apps and ChecklistWizard pick them by name, as the backend does).
            id: 'fold_check',
            title: 'Fold & Flip Check',
            subtitle: 'Only for folding phones: the outer screen and the hinge',
            type: 'combined-step',
            showFor: 'foldable',
            sections: [
                {
                    id: 'cover_screen',
                    title: 'Outer (cover) screen',
                    type: 'single-select',
                    options: [
                        { id: 'fine', label: 'Working fine', description: 'No lines, spots or cracks', icon: 'CheckCircle2' },
                        { id: 'damaged', label: 'Damaged', description: 'Lines, broken glass or spots on the outer screen', icon: 'AlertTriangle' },
                    ]
                },
                {
                    id: 'hinge',
                    title: 'Hinge',
                    type: 'single-select',
                    options: [
                        { id: 'fine', label: 'Opens and closes properly', description: 'Smooth, holds its position, no gap or noise', icon: 'CheckCircle2' },
                        { id: 'faulty', label: 'Loose or does not open properly', description: 'Stiff, wobbly, gaps, or does not fold flat', icon: 'AlertTriangle' },
                    ]
                }
            ]
        },
        {
            // Only iPhones. A locked iPhone cannot be bought: choosing it stops the check (stopsSale).
            id: 'icloud_lock',
            title: 'iCloud / Apple ID Lock',
            subtitle: 'Is the iPhone signed out of iCloud, with Find My turned off?',
            type: 'single-select',
            showFor: 'apple',
            options: [
                { id: 'not_locked', label: 'Not locked', description: 'Signed out of iCloud, Find My is off', icon: 'Unlock' },
                {
                    id: 'locked', label: 'Still locked', description: 'Still signed in to an Apple ID, or Find My is on', icon: 'Lock',
                    stopsSale: 'We can’t buy an iPhone that is still locked to an Apple ID. On the iPhone, open Settings → your name → Sign Out (this also turns off Find My), then choose “Not locked”.',
                },
            ]
        },
        {
            id: 'functional_issues',
            title: 'Functional Problems',
            subtitle: 'Select any issues your device has (Check if applicable)',
            type: 'multi-select-grid',
            options: [
                { id: 'wifi', label: 'WiFi', icon: 'Wifi', group: 'Network & connectivity' },
                { id: 'sim1', label: 'Sim 1', icon: 'Smartphone', group: 'Network & connectivity' },
                { id: 'sim2', label: 'Sim 2', icon: 'Smartphone', group: 'Network & connectivity' },
                { id: 'bluetooth', label: 'Bluetooth', icon: 'Bluetooth', group: 'Network & connectivity' },
                { id: 'screen_replaced', label: 'Screen Not Original', icon: 'Smartphone', group: 'Display' },
                { id: 'touch_faulty', label: 'Touch Not Working Properly', icon: 'Hand', group: 'Display' },
                { id: 'screen_discoloration', label: 'Screen Discoloration / Patches', icon: 'Palette', group: 'Display' },
                { id: 'loose_screen', label: 'Loose Screen (Gap from Body)', icon: 'Maximize', group: 'Display' },
                { id: 'camera_glass', label: 'Camera Glass / Lens Broken', icon: 'CameraOff', group: 'Camera' },
                { id: 'back_camera', label: 'Back Camera', icon: 'Camera', group: 'Camera' },
                { id: 'back_camera_blur', label: 'Back Camera Image Blur / Spot', icon: 'Image', group: 'Camera' },
                { id: 'front_camera', label: 'Front Camera', icon: 'Camera', group: 'Camera' },
                { id: 'front_camera_blur', label: 'Front Camera Image Blur / Spot', icon: 'Image', group: 'Camera' },
                { id: 'finger_sensor', label: 'Finger Touch Sensor', icon: 'Fingerprint', group: 'Sensors' },
                { id: 'face_sensor', label: 'Face Sensor', icon: 'User', group: 'Sensors' },
                { id: 'proximity', label: 'Proximity Sensor', icon: 'Move', group: 'Sensors' },
                { id: 'power_button', label: 'Power Button', icon: 'Power', group: 'Buttons & controls' },
                { id: 'volume_button', label: 'Volume Button', icon: 'Volume2', group: 'Buttons & controls' },
                { id: 'silent_button', label: 'Silent Button', icon: 'BellOff', group: 'Buttons & controls' },
                { id: 'speaker', label: 'Speaker', icon: 'Speaker', group: 'Sound & vibration' },
                { id: 'earpiece', label: 'Ear Piece', icon: 'Phone', group: 'Sound & vibration' },
                { id: 'audio_jack', label: 'Audio Jack', icon: 'Headphones', group: 'Sound & vibration' },
                { id: 'microphone', label: 'Microphone', icon: 'Mic', group: 'Sound & vibration' },
                { id: 'audio_ic', label: 'Audio IC', icon: 'Music', group: 'Sound & vibration' },
                { id: 'vibrator', label: 'Vibrator', icon: 'Vibrate', group: 'Sound & vibration' },
                { id: 'charging_port', label: 'Charging Port', icon: 'Plug', group: 'Battery & charging' },
                { id: 'battery', label: 'Battery', icon: 'Battery', group: 'Battery & charging' },
            ]
        },
        {
            id: 'device_details',
            title: 'Device Details',
            subtitle: 'Please confirm accessories and warranty details',
            type: 'combined-step',
            sections: [
                {
                    id: 'purchase_location',
                    title: 'Where was the device purchased?',
                    type: 'single-select',
                    options: [
                        { id: 'india', label: 'Purchased in India', icon: 'MapPin' },
                        { id: 'global', label: 'Purchased Globally', icon: 'Globe' }
                    ]
                },
                {
                    id: 'accessories',
                    title: 'Do you have the following?',
                    type: 'multi-select',
                    options: [
                        { id: 'charger', label: 'Original Charger', icon: 'Plug' },
                        { id: 'box', label: 'Original Box', icon: 'Box' },
                        { id: 'bill', label: 'Original Bill with GST', icon: 'FileText' },
                    ]
                },
                {
                    id: 'warranty',
                    title: 'Device age',
                    type: 'single-select',
                    options: [
                        { id: '0_3_months', label: '0 - 3 Months', description: 'Bought less than 3 months ago', icon: 'Clock' },
                        { id: '3_6_months', label: '3 - 6 Months', description: 'Bought 3 to 6 months ago', icon: 'Clock' },
                        { id: '6_11_months', label: '6 - 11 Months', description: 'Bought 6 to 11 months ago', icon: 'Clock' },
                    ]
                }
            ]
        }
    ],
    'tablet': [
        {
            id: 'core_functionality',
            title: 'Tablet Condition Check',
            subtitle: 'Answer these to get the best price.',
            questions: [
                { id: 'power', text: 'Does the device turn on?', subtext: 'Ensure the tablet powers up and boots completely.', type: 'boolean' },
                { id: 'touch', text: 'Is the touch working seamlessly?', subtext: 'No dead zones or ghost touches.', type: 'boolean' },
                { id: 'wifi', text: 'Is WiFi working?', subtext: 'Can it connect to networks?', type: 'boolean' }
            ]
        },
        {
            id: 'physical_condition',
            title: 'Physical Condition',
            subtitle: 'Select the screen\'s physical condition',
            type: 'single-select',
            options: [
                { id: 'flawless', label: 'Flawless', description: 'No signs of usage', icon: 'Sparkles' },
                { id: 'good', label: 'Good', description: 'Minor scratches', icon: 'Smile' },
                { id: 'average', label: 'Average', description: 'Major scratches', icon: 'MinusCircle' },
                { id: 'below_average', label: 'Below Average', description: 'Screen crack, Dead pixel, Lines on screen', icon: 'AlertTriangle' },
            ]
        },
        {
            id: 'body_condition',
            title: 'Body Condition',
            subtitle: 'Select the condition of the device body (back panel/frame)',
            type: 'single-select',
            options: [
                { id: 'flawless', label: 'Flawless', description: 'No scratches or dents', icon: 'Sparkles' },
                { id: 'good', label: 'Good', description: 'Minor scratches, no dents', icon: 'Smile' },
                { id: 'average', label: 'Average', description: 'Visible scratches and minor dents', icon: 'MinusCircle' },
                { id: 'below_average', label: 'Below Average', description: 'Heavy dents, cracks, or bent frame', icon: 'AlertTriangle' },
            ]
        },
        {
            id: 'functional_issues',
            title: 'Functional Problems',
            subtitle: 'Select any issues your device has (Check if applicable)',
            type: 'multi-select-grid',
            options: [
                { id: 'bluetooth', label: 'Bluetooth', icon: 'Bluetooth', group: 'Network & connectivity' },
                { id: 'front_camera', label: 'Front Camera', icon: 'Camera', group: 'Camera' },
                { id: 'back_camera', label: 'Back Camera', icon: 'Camera', group: 'Camera' },
                { id: 'camera_glass', label: 'Camera Glass Broken', icon: 'CameraOff', group: 'Camera' },
                { id: 'power_button', label: 'Power Button', icon: 'Power', group: 'Buttons & controls' },
                { id: 'volume_button', label: 'Volume Button', icon: 'Volume2', group: 'Buttons & controls' },
                { id: 'speaker', label: 'Speaker', icon: 'Speaker', group: 'Sound & vibration' },
                { id: 'microphone', label: 'Microphone', icon: 'Mic', group: 'Sound & vibration' },
                { id: 'charging_port', label: 'Charging Port', icon: 'Plug', group: 'Battery & charging' },
                { id: 'battery', label: 'Battery', icon: 'Battery', group: 'Battery & charging' },
            ]
        },
        {
            id: 'device_details',
            title: 'Device Details',
            subtitle: 'Please confirm accessories and warranty details',
            type: 'combined-step',
            sections: [
                {
                    id: 'purchase_location',
                    title: 'Where was the device purchased?',
                    type: 'single-select',
                    options: [
                        { id: 'india', label: 'Purchased in India', icon: 'MapPin' },
                        { id: 'global', label: 'Purchased Globally', icon: 'Globe' }
                    ]
                },
                {
                    id: 'accessories',
                    title: 'Do you have the following?',
                    type: 'multi-select',
                    options: [
                        { id: 'charger', label: 'Original Charger', icon: 'Plug' },
                        { id: 'box', label: 'Original Box', icon: 'Box' },
                        { id: 'bill', label: 'Original Bill with GST', icon: 'FileText' },
                    ]
                },
                {
                    id: 'warranty',
                    title: 'Device age',
                    type: 'single-select',
                    options: [
                        { id: '0_3_months', label: '0 - 3 Months', description: 'Bought less than 3 months ago', icon: 'Clock' },
                        { id: '3_6_months', label: '3 - 6 Months', description: 'Bought 3 to 6 months ago', icon: 'Clock' },
                        { id: '6_11_months', label: '6 - 11 Months', description: 'Bought 6 to 11 months ago', icon: 'Clock' },
                    ]
                }
            ]
        }
    ],
    'watch': [
        {
            id: 'core_functionality',
            title: 'Smartwatch Condition Check',
            subtitle: 'Answer these to get the best price.',
            questions: [
                { id: 'power', text: 'Does the watch Switch On?', subtext: 'Cashify currently only accepts devices that switch on.', type: 'boolean' },
                { id: 'touch', text: 'Is the touch working seamlessly?', subtext: 'No dead zones or ghost touches.', type: 'boolean' },
                { id: 'charging', text: 'Does it charge correctly?', subtext: 'Charging sensor/magnetic port working.', type: 'boolean' }
            ]
        },
        {
            id: 'physical_condition',
            title: 'Screen Condition',
            subtitle: 'Select the screen\'s physical condition',
            type: 'single-select',
            options: [
                { id: 'flawless', label: 'Flawless', description: 'No signs of usage, no scratches', icon: 'Sparkles' },
                { id: 'good', label: 'Good', description: 'Minor scratches (1-2 light)', icon: 'Smile' },
                { id: 'average', label: 'Average', description: 'Major scratches or slight wear', icon: 'MinusCircle' },
                { id: 'damaged', label: 'Damaged/Cracked', description: 'Cracks, spots, or lines on screen', icon: 'AlertTriangle' },
            ]
        },
        {
            id: 'body_condition',
            title: 'Body Condition',
            subtitle: 'Select the condition of the watch body',
            type: 'single-select',
            options: [
                { id: 'flawless', label: 'Flawless', description: 'Brand new look, no imperfections', icon: 'Sparkles' },
                { id: 'good', label: 'Good', description: 'Minor scratches, no dents', icon: 'Smile' },
                { id: 'average', label: 'Average', description: 'Moderate scratches or minor dents', icon: 'MinusCircle' },
                { id: 'below_average', label: 'Below Average', description: 'Deep scratches, major dents, or glass broken', icon: 'AlertTriangle' },
            ]
        },
        {
            id: 'functional_issues',
            title: 'Functional Problems',
            subtitle: 'Select if applicable (Check if applicable)',
            type: 'multi-select-grid',
            options: [
                { id: 'wifi', label: 'WiFi/GPS Faulty', icon: 'Wifi', group: 'Network & connectivity' },
                { id: 'bluetooth', label: 'Bluetooth Faulty', icon: 'Bluetooth', group: 'Network & connectivity' },
                { id: 'heart_sensor', label: 'Heart Sensor Faulty', icon: 'Activity', group: 'Sensors' },
                { id: 'crown', label: 'Digital Crown Issues', icon: 'Settings', group: 'Buttons & controls' },
                { id: 'buttons', label: 'Side Buttons Faulty', icon: 'Power', group: 'Buttons & controls' },
                { id: 'speaker', label: 'Speakers Faulty', icon: 'Speaker', group: 'Sound & vibration' },
                { id: 'battery_low', label: 'Battery Health < 85%', icon: 'Battery', group: 'Battery & charging' },
            ]
        },
        {
            id: 'device_details',
            title: 'Device Details',
            subtitle: 'Please confirm accessories and warranty',
            type: 'combined-step',
            sections: [
                {
                    id: 'purchase_location',
                    title: 'Where was the device purchased?',
                    type: 'single-select',
                    options: [
                        { id: 'india', label: 'Purchased in India', icon: 'MapPin' },
                        { id: 'global', label: 'Purchased Globally', icon: 'Globe' }
                    ]
                },
                {
                    id: 'accessories',
                    title: 'Do you have the following?',
                    type: 'multi-select',
                    options: [
                        { id: 'charger', label: 'Original Charger', icon: 'Plug' },
                        { id: 'strap', label: 'Original Strap', icon: 'Watch' },
                        { id: 'box', label: 'Original Box', icon: 'Box' },
                        { id: 'bill', label: 'Original Bill with GST', icon: 'FileText' },
                    ]
                },
                {
                    id: 'warranty',
                    title: 'Device age',
                    type: 'single-select',
                    options: [
                        { id: '0_3_months', label: '0 - 3 Months', description: 'Bought less than 3 months ago', icon: 'Clock' },
                        { id: '3_6_months', label: '3 - 6 Months', description: 'Bought 3 to 6 months ago', icon: 'Clock' },
                        { id: '6_11_months', label: '6 - 11 Months', description: 'Bought 6 to 11 months ago', icon: 'Clock' },
                    ]
                }
            ]
        }
    ],
    'console': [
        {
            id: 'core_functionality',
            title: 'Console Check',
            subtitle: 'Let\'s check your gaming gear.',
            questions: [
                { id: 'power', text: 'Does it power on correctly?', subtext: 'No overheating or auto-shutdowns.', type: 'boolean' },
                { id: 'drive', text: 'Does the disc drive work?', subtext: 'Reads games without issues (if applicable).', type: 'boolean' },
                { id: 'controller', text: 'Is the controller included & working?', subtext: 'No drift issues.', type: 'boolean' }
            ]
        },
        {
            id: 'cosmetic',
            title: 'Cosmetic Condition',
            subtitle: 'Any physical issues?',
            type: 'multi-select',
            options: [
                { id: 'body_cracks', label: 'Cracks on Console Body', icon: 'Box' },
                { id: 'ports_damaged', label: 'HDMI/USB Ports Damaged', icon: 'Plug' },
            ]
        }
    ],
    'tv': [
        {
            id: 'physical_condition',
            title: 'Screen / Display Condition',
            subtitle: 'Select the screen\'s physical and display condition',
            type: 'single-select',
            options: [
                { id: 'flawless', label: 'Flawless', description: 'Perfect screen, no scratches or lines', icon: 'Sparkles' },
                { id: 'good', label: 'Good', description: 'Minor hairline scratches on screen', icon: 'Smile' },
                { id: 'average', label: 'Average', description: 'Visible deep scratches on screen', icon: 'MinusCircle' },
                { id: 'damaged', label: 'Damaged Screen', description: 'Screen crack, dead pixels, horizontal/vertical lines, color patches', icon: 'AlertTriangle' },
            ]
        },
        {
            id: 'body_condition',
            title: 'Body & Frame Condition',
            subtitle: 'Select the condition of the TV frame, bezel, and back panel',
            type: 'single-select',
            options: [
                { id: 'flawless', label: 'Flawless', description: 'No scratches, dents, or scuffs', icon: 'Sparkles' },
                { id: 'good', label: 'Good', description: 'Minor scratches or scuffs, no dents/cracks', icon: 'Smile' },
                { id: 'average', label: 'Average', description: 'Visible major scratches, scuffs or minor dents', icon: 'MinusCircle' },
                { id: 'below_average', label: 'Below Average', description: 'Heavy dents, deep cracks, or broken frame/bezel', icon: 'AlertTriangle' },
            ]
        },
        {
            id: 'functional_issues',
            title: 'Functional Problems',
            subtitle: 'Select any issues your TV has (Check if applicable)',
            type: 'multi-select-grid',
            options: [
                { id: 'wifi', label: 'WiFi / Smart features Faulty', icon: 'Wifi', group: 'Network & connectivity' },
                { id: 'bluetooth', label: 'Bluetooth Faulty', icon: 'Bluetooth', group: 'Network & connectivity' },
                { id: 'remote_sensor', label: 'Remote Sensor Not Responding', icon: 'Tv', group: 'Sensors' },
                { id: 'sound', label: 'Speakers / Sound Faulty', icon: 'VolumeX', group: 'Sound & vibration' },
                { id: 'power_fault', label: 'Power Supply / Auto Shutdown Issues', icon: 'PowerOff', group: 'Display & power' },
                { id: 'display_flicker', label: 'Screen Flicker / Dim Display', icon: 'SunDim', group: 'Display & power' },
                { id: 'ports', label: 'HDMI / USB Ports Faulty', icon: 'Plug', group: 'Ports & slots' },
            ]
        },
        {
            id: 'device_details',
            title: 'Device Details',
            subtitle: 'Please confirm accessories and warranty details',
            type: 'combined-step',
            sections: [
                {
                    id: 'purchase_location',
                    title: 'Where was the TV purchased?',
                    type: 'single-select',
                    options: [
                        { id: 'india', label: 'Purchased in India', icon: 'MapPin' },
                        { id: 'global', label: 'Purchased Globally', icon: 'Globe' }
                    ]
                },
                {
                    id: 'accessories',
                    title: 'Do you have the following accessories?',
                    type: 'multi-select',
                    options: [
                        { id: 'remote', label: 'Original Remote', icon: 'Tv' },
                        { id: 'stand', label: 'Table Top Stand', icon: 'Box' },
                        { id: 'wall_mount', label: 'Wall Mount', icon: 'Grid' },
                        { id: 'bill', label: 'Original Bill with GST', icon: 'FileText' },
                        { id: 'box', label: 'Original Box', icon: 'Box' },
                    ]
                },
                {
                    id: 'warranty',
                    title: 'Device age',
                    type: 'single-select',
                    options: [
                        { id: '0_3_months', label: '0 - 3 Months', description: 'Bought less than 3 months ago', icon: 'Clock' },
                        { id: '3_6_months', label: '3 - 6 Months', description: 'Bought 3 to 6 months ago', icon: 'Clock' },
                        { id: '6_11_months', label: '6 - 11 Months', description: 'Bought 6 to 11 months ago', icon: 'Clock' },
                    ]
                }
            ]
        }
    ],
    'laptop': [
        {
            id: 'core_functionality',
            title: 'Laptop Basics',
            subtitle: 'Quick health check.',
            questions: [
                { id: 'power', text: 'Does it power on & boot?', subtext: '', type: 'boolean' },
                { id: 'ports', text: 'Do all USB/Charging ports work?', subtext: '', type: 'boolean' },
                { id: 'screen_working', text: 'Is the Display functioning?', subtext: 'No flicker or dead pixels.', type: 'boolean' },
                { id: 'keyboard', text: 'Keyboard & Trackpad working?', subtext: '', type: 'boolean' }
            ]
        },
        {
            id: 'physical_condition',
            title: 'Physical Condition',
            subtitle: 'Any damage?',
            type: 'multi-select',
            options: [
                { id: 'screen_damage', label: 'Broken Screen/Hinges', icon: 'Laptop' },
                { id: 'body_damage', label: 'Heavy Dents/Cracks on Body', icon: 'ShieldAlert' },
                { id: 'battery_dead', label: 'Battery Dead/Not Charging', icon: 'Battery' },
                { id: 'keys_missing', label: 'Keys Missing/Broken', icon: 'Keyboard' },
            ]
        },
        {
            id: 'specs',
            title: 'System Specs',
            subtitle: 'Confirm configuration',
            type: 'multi-select',
            options: [
                { id: 'charger_missing', label: 'Original Charger Missing', icon: 'Plug' },
                { id: 'box_missing', label: 'Original Box Missing', icon: 'Box' }
            ]
        }
    ],
    'camera': [
        {
            id: 'core_functionality',
            title: 'Camera Condition Check',
            subtitle: 'Let\'s check the basic functionality of your camera.',
            questions: [
                { id: 'power', text: 'Does the camera turn on?', subtext: 'Ensure the camera powers up and display is active.', type: 'boolean' },
                { id: 'lens_focus', text: 'Does the lens autofocus work?', subtext: 'Ensure the lens can focus on subjects correctly.', type: 'boolean' },
                { id: 'sensor_spots', text: 'Are there any spots on the sensor?', subtext: 'Spots visible in images at high aperture.', type: 'boolean' },
                { id: 'flash', text: 'Is the built-in flash working?', subtext: 'If applicable to your model.', type: 'boolean' }
            ]
        },
        {
            id: 'physical_condition',
            title: 'Physical Condition',
            subtitle: 'Select the body\'s physical condition',
            type: 'single-select',
            options: [
                { id: 'flawless', label: 'Flawless', description: 'No signs of usage, like new', icon: 'Sparkles' },
                { id: 'good', label: 'Good', description: 'Minor scratches, well maintained', icon: 'Smile' },
                { id: 'average', label: 'Average', description: 'Visible scratches and minor dents', icon: 'MinusCircle' },
                { id: 'below_average', label: 'Below Average', description: 'Heavy dents, cracks, or missing rubber grips', icon: 'AlertTriangle' },
            ]
        },
        {
            id: 'screen_condition',
            title: 'Screen/Viewfinder',
            subtitle: 'Select the condition of the display/viewfinder',
            type: 'single-select',
            options: [
                { id: 'flawless', label: 'Flawless', description: 'Clear display, no issues', icon: 'Sparkles' },
                { id: 'cracked', label: 'Cracked/Damaged', description: 'Screen or viewfinder glass broken', icon: 'AlertTriangle' },
                { id: 'dead_pixels', label: 'Dead Pixels/Lines', icon: 'Grid' },
            ]
        },
        {
            id: 'functional_issues',
            title: 'Functional Problems',
            subtitle: 'Select any issues your camera has (Check if applicable)',
            type: 'multi-select-grid',
            options: [
                { id: 'buttons', label: 'Buttons/Dial Not Working', icon: 'MousePointer2', group: 'Buttons & controls' },
                { id: 'mode_dial', label: 'Mode Dial Faulty', icon: 'Settings', group: 'Buttons & controls' },
                { id: 'card_slot', label: 'Memory Card Slot Issue', icon: 'CreditCard', group: 'Ports & slots' },
                { id: 'hdmi_usb', label: 'HDMI/USB Port Damaged', icon: 'Plug', group: 'Ports & slots' },
                { id: 'mic_jack', label: 'Mic/Audio Jack Not Working', icon: 'Mic', group: 'Ports & slots' },
                { id: 'battery_door', label: 'Battery Door Broken/Loose', icon: 'Battery', group: 'Miscellaneous' },
            ]
        },
        {
            id: 'device_details',
            title: 'Accessories & Warranty',
            subtitle: 'Please confirm what\'s included',
            type: 'combined-step',
            sections: [
                {
                    id: 'purchase_location',
                    title: 'Where was the device purchased?',
                    type: 'single-select',
                    options: [
                        { id: 'india', label: 'Purchased in India', icon: 'MapPin' },
                        { id: 'global', label: 'Purchased Globally', icon: 'Globe' }
                    ]
                },
                {
                    id: 'accessories',
                    title: 'Do you have the following?',
                    type: 'multi-select',
                    options: [
                        { id: 'battery', label: 'Original Battery', icon: 'Battery' },
                        { id: 'charger', label: 'Original Charger', icon: 'Plug' },
                        { id: 'lens_cap', label: 'Lens Cap / Body Cap', icon: 'Circle' },
                        { id: 'strap', label: 'Neck/Shoulder Strap', icon: 'Smartphone' }, // Using Smartphone as proxy or better icon?
                        { id: 'box', label: 'Original Box', icon: 'Box' },
                        { id: 'bill', label: 'Original Bill with GST', icon: 'FileText' },
                    ]
                },
                {
                    id: 'warranty',
                    title: 'Device age',
                    type: 'single-select',
                    options: [
                        { id: '0_3_months', label: '0 - 3 Months', description: 'Bought less than 3 months ago', icon: 'Clock' },
                        { id: '3_6_months', label: '3 - 6 Months', description: 'Bought 3 to 6 months ago', icon: 'Clock' },
                        { id: '6_11_months', label: '6 - 11 Months', description: 'Bought 6 to 11 months ago', icon: 'Clock' },
                    ]
                }
            ]
        }
    ],
    'desktop': [
        {
            id: 'core_functionality',
            title: 'Desktop Check',
            subtitle: 'Functionality & Performance',
            questions: [
                { id: 'power', text: 'Does it power on & boot?', subtext: '', type: 'boolean' },
                { id: 'display_output', text: 'Video output working?', subtext: 'HDMI/DP ports functioning.', type: 'boolean' },
                { id: 'ports', text: 'All USB ports working?', subtext: '', type: 'boolean' }
            ]
        },
        {
            id: 'physical_condition',
            title: 'Physical Condition',
            subtitle: 'Cabin / Body health',
            type: 'single-select',
            options: [
                { id: 'flawless', label: 'Flawless', description: 'Like new cabinet', icon: 'Sparkles' },
                { id: 'good', label: 'Good', description: 'Minor scratches', icon: 'Smile' },
                { id: 'average', label: 'Average', description: 'Dents or major wear', icon: 'MinusCircle' },
                { id: 'below_average', label: 'Damaged', description: 'Cabinet broken or missing panels', icon: 'AlertTriangle' },
            ]
        },
        {
            id: 'device_details',
            title: 'Accessories',
            subtitle: 'Cables & Peripherals',
            type: 'combined-step',
            sections: [
                {
                    id: 'accessories',
                    title: 'Included Items',
                    type: 'multi-select',
                    options: [
                        { id: 'power_cable', label: 'Power Cable', icon: 'Plug' },
                        { id: 'keyboard_mouse', label: 'Keyboard & Mouse', icon: 'Keyboard' },
                        { id: 'bill', label: 'Original Bill', icon: 'FileText' },
                    ]
                }
            ]
        }
    ],
    'earbuds': [
        {
            id: 'core_functionality',
            title: 'Earbuds Check',
            subtitle: 'Sound & Battery',
            questions: [
                { id: 'power', text: 'Do both sides work?', subtext: 'Left and Right audio clear.', type: 'boolean' },
                { id: 'charging', text: 'Does case charge correctly?', subtext: '', type: 'boolean' },
                { id: 'anc', text: 'Is ANC/Transparency working?', subtext: 'If applicable.', type: 'boolean' }
            ]
        },
        {
            id: 'physical_condition',
            title: 'Physical Condition',
            subtitle: 'Case & Buds health',
            type: 'single-select',
            options: [
                { id: 'flawless', label: 'Flawless', description: 'No scratches', icon: 'Sparkles' },
                { id: 'good', label: 'Good', description: 'Minor scratches', icon: 'Smile' },
                { id: 'average', label: 'Average', description: 'Visible dents/yellowing', icon: 'MinusCircle' },
                { id: 'damaged', label: 'Damaged', description: 'Buds or Case cracked', icon: 'AlertTriangle' },
            ]
        },
        {
            id: 'accessories',
            title: 'What\'s included?',
            subtitle: 'Original items',
            type: 'multi-select',
            options: [
                { id: 'box', label: 'Original Box', icon: 'Box' },
                { id: 'bill', label: 'Original Bill', icon: 'FileText' },
                { id: 'charging_cable', label: 'Original Cable', icon: 'Plug' },
            ]
        }
    ]
};
