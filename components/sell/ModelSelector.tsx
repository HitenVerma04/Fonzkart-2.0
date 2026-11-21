'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from "framer-motion";
import { ArrowLeft, ChevronDown, Search, X } from "lucide-react";
import Image from "next/image";
import { Model } from '@/lib/store';
import { fetchModels } from '@/actions/catalog';
import { deduplicateModels, resolveModelImage } from '@/lib/catalog2026';
import { groupSeries } from '@/lib/series';

/** localStorage: whether the phone series panel is open (folded away by the customer: 'closed'). */
const SERIES_PANEL_KEY = 'fz-series-panel';
import SVGLoader from "@/components/ui/SVGLoader";

interface ModelSelectorProps {
    brandId: string;
    /** The brand's display name ("Realme"), for the series names. */
    brandName?: string;
    category?: string;
    originalCategory?: string;
    onSelect: (model: Model) => void;
    onBack: () => void;
}

const EXCLUDED_MODELS = new Set([
    "iPhone 17", "iPhone 17 Air",
    "iPhone 16 Plus", "iPhone 16", "iPhone 16e", "iPhone 16 E",
    "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
    "iPhone XS Max", "iPhone XS"
]);

// Helper Component for Image Fallback
const ModelImage = ({ src, alt, brandId = '', priority = false, scale = 1 }: { src: string, alt: string, brandId?: string, priority?: boolean, scale?: number }) => {
    const [imgSrc, setImgSrc] = useState(() => resolveModelImage(brandId, alt, src));

    useEffect(() => {
        setImgSrc(resolveModelImage(brandId, alt, src));
    }, [src, brandId, alt]);

    const handleError = () => {
        const fallback = resolveModelImage(brandId, alt);
        if (imgSrc !== fallback) {
            setImgSrc(fallback);
        }
    };

    return (
        <Image
            src={imgSrc}
            alt={alt}
            fill
            priority={priority}
            className="object-contain p-1 transition-transform duration-300"
            style={{ transform: `scale(${scale})` }}
            sizes="(max-width: 768px) 50vw, 25vw"
            onError={handleError}
            unoptimized
        />
    );
};

export default function ModelSelector({ brandId, brandName, category, originalCategory, onSelect, onBack }: ModelSelectorProps) {
    const [models, setModels] = useState<Model[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSeries, setActiveSeries] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        setIsLoading(true);

        fetchModels(brandId, category)
            .then(data => {
                if (mounted) {
                    let processedData = data;
                    if (originalCategory === 'unbreakable-screenguard') {
                        processedData = data.filter(model => {
                            const name = model.name.toLowerCase();
                            if (name.includes('iphone')) {
                                return name.includes('iphone 15') || 
                                       name.includes('iphone 16') || 
                                       name.includes('iphone 17') ||
                                       name.includes('iphone 18');
                            }
                            if (name.includes('sams') || name.includes('galaxy')) {
                                return name.includes('s24') || name.includes('s25');
                            }
                            if (name.includes('oneplus')) {
                                return name.includes('oneplus 13') || name.includes('oneplus 15');
                            }
                            if (name.includes('pixel') || name.includes('google')) {
                                return name.includes('pixel 9') || name.includes('pixel 10');
                            }
                            return true;
                        });
                    }

                    // Exclude specific Poco models as requested
                    processedData = processedData.filter(model => {
                        const name = model.name;
                        if (name === 'Poco F6' || name === 'Poco M6 Pro' || name === 'Poco X6' || name === 'Poco X6 Pro') {
                            return false;
                        }
                        return true;
                    });

                    setModels(processedData);
                    setIsLoading(false);
                }
            })
            .catch(err => {
                console.error("Failed to fetch models:", err);
                if (mounted) setIsLoading(false);
            });

        return () => { mounted = false; };
    }, [brandId, category]);

    // Extract Series Logic
    // Extract Series Logic
    const seriesList = useMemo(() => {
        const uniqueSeries = new Set<string>();
        const bId = (brandId || '').toLowerCase().trim();

        models.forEach(m => {
            const name = m.name || '';
            const lowerName = name.toLowerCase();

            // Tablet - Apple
            if (lowerName.includes('ipad')) {
                if (lowerName.includes('pro')) uniqueSeries.add('iPad Pro');
                else if (lowerName.includes('air')) uniqueSeries.add('iPad Air');
                else if (lowerName.includes('mini')) uniqueSeries.add('iPad mini');
                else uniqueSeries.add('iPad (Standard)');
                return;
            }
            // Tablet - Samsung
            if (lowerName.includes('galaxy tab') || (category === 'tablet' && (bId === 'samsung' || lowerName.includes('tab')))) {
                if (lowerName.includes('tab s')) uniqueSeries.add('Galaxy Tab S');
                else if (lowerName.includes('tab a')) uniqueSeries.add('Galaxy Tab A');
                else uniqueSeries.add('Other Galaxy Tab');
                return;
            }
            // Tablet - OnePlus
            if (lowerName.includes('oneplus pad') || (category === 'tablet' && bId === 'oneplus')) {
                uniqueSeries.add('OnePlus Pad');
                return;
            }
            // Tablet - Realme
            if (lowerName.includes('realme pad')) {
                uniqueSeries.add('Realme Pad');
                return;
            }
            // Tablet - Xiaomi / Poco / Lenovo / Moto / Nokia
            if (lowerName.includes('xiaomi pad') || lowerName.includes('mi pad')) { uniqueSeries.add('Xiaomi Pad'); return; }
            if (lowerName.includes('redmi pad')) { uniqueSeries.add('Redmi Pad'); return; }
            if (lowerName.includes('oppo pad')) { uniqueSeries.add('Oppo Pad'); return; }
            if (lowerName.includes('poco pad')) { uniqueSeries.add('Poco Pad'); return; }
            if (lowerName.includes('lenovo tab')) { uniqueSeries.add('Lenovo Tab'); return; }
            if (lowerName.includes('yoga tab')) { uniqueSeries.add('Lenovo Yoga Tab'); return; }
            if (lowerName.includes('moto tab') || lowerName.includes('motorola tab')) { uniqueSeries.add('Moto Tab'); return; }
            if (lowerName.includes('nokia t')) { uniqueSeries.add('Nokia T Series'); return; }

            // Smartwatch - Apple Watch
            if (lowerName.includes('apple') && (lowerName.includes('watch') || lowerName.includes('ultra') || lowerName.includes('series'))) {
                if (lowerName.includes('ultra')) uniqueSeries.add('Watch Ultra');
                else if (lowerName.includes('se')) uniqueSeries.add('Watch SE');
                const seriesMatch = name.match(/Series\s+(\d+)/i);
                if (seriesMatch) {
                    uniqueSeries.add(`Series ${seriesMatch[1]}`);
                } else if (!lowerName.includes('ultra') && !lowerName.includes('se')) {
                    uniqueSeries.add('Watch Series');
                }
                return;
            }

            // 1. Samsung
            if (bId === 'samsung' || lowerName.includes('galaxy') || lowerName.includes('samsung')) {
                if (lowerName.includes('galaxy s') || lowerName.includes(' s2') || lowerName.includes(' s1') || lowerName.startsWith('s2') || lowerName.startsWith('s1')) uniqueSeries.add('S Series');
                else if (lowerName.includes('galaxy a') || lowerName.includes(' a') || lowerName.startsWith('a')) uniqueSeries.add('A Series');
                else if (lowerName.includes('galaxy m') || lowerName.includes(' m') || lowerName.startsWith('m')) uniqueSeries.add('M Series');
                else if (lowerName.includes('galaxy f') || lowerName.includes(' f') || lowerName.startsWith('f')) uniqueSeries.add('F Series');
                else if (lowerName.includes('fold')) uniqueSeries.add('Z Fold Series');
                else if (lowerName.includes('flip')) uniqueSeries.add('Z Flip Series');
                else if (lowerName.includes('note')) uniqueSeries.add('Note Series');
                else uniqueSeries.add('Other Galaxy');
                return;
            }

            // 2. Apple
            if (bId === 'apple' || lowerName.includes('iphone')) {
                if (lowerName.includes('air')) uniqueSeries.add('Air Series');
                const match = lowerName.match(/iphone\s+(\d+)/i) || lowerName.match(/^(\d+)\b/);
                if (match) {
                    uniqueSeries.add(`${match[1]} Series`);
                }
                if (lowerName.includes('iphone x') || lowerName.includes(' xr') || lowerName.includes(' xs') || lowerName === 'iphone x') uniqueSeries.add('X Series');
                if (lowerName.includes('se')) uniqueSeries.add('SE Series');
                return;
            }

            // 3. OnePlus
            if (bId === 'oneplus' || lowerName.includes('oneplus')) {
                if (lowerName.includes('nord') || lowerName.includes('ce') || lowerName.includes('n6') || lowerName.includes('n20') || lowerName.includes('n10') || lowerName.includes('n100') || lowerName.includes('n200') || lowerName.includes('n300')) {
                    uniqueSeries.add('OnePlus Nord Series');
                } else if (lowerName.includes('open') || lowerName.includes('fold')) {
                    uniqueSeries.add('OnePlus Open Series');
                } else if (lowerName.match(/oneplus\s+\d+/i) || lowerName.match(/\b\d+[rt]?\b/i) || lowerName.includes(' pro')) {
                    uniqueSeries.add('OnePlus Number Series');
                } else {
                    uniqueSeries.add('OnePlus Other');
                }
                return;
            }

            // 4. Xiaomi / Redmi
            if (bId === 'xiaomi' || bId === 'redmi' || lowerName.includes('xiaomi') || lowerName.includes('redmi') || lowerName.includes('mi ')) {
                if (lowerName.includes('note')) uniqueSeries.add('Redmi Note Series');
                else if (lowerName.includes('turbo')) uniqueSeries.add('Redmi Turbo Series');
                else if (lowerName.includes('redmi k') || lowerName.includes(' k')) uniqueSeries.add('Redmi K Series');
                else if (lowerName.includes('redmi a') || lowerName.includes(' a')) uniqueSeries.add('Redmi A Series');
                else if (lowerName.includes('redmi')) uniqueSeries.add('Redmi Number Series');
                else if (lowerName.includes('xiaomi') || lowerName.includes('mi ')) uniqueSeries.add('Xiaomi Number Series');
                else uniqueSeries.add('Xiaomi / Redmi Other');
                return;
            }

            // 5. Vivo
            if (bId === 'vivo' || lowerName.includes('vivo')) {
                if (lowerName.includes('vivo x') || lowerName.includes(' x') || lowerName.startsWith('x')) uniqueSeries.add('Vivo X Series');
                else if (lowerName.includes('vivo v') || lowerName.includes(' v') || lowerName.startsWith('v')) uniqueSeries.add('Vivo V Series');
                else if (lowerName.includes('vivo t') || lowerName.includes(' t') || lowerName.startsWith('t')) uniqueSeries.add('Vivo T Series');
                else if (lowerName.includes('vivo y') || lowerName.includes(' y') || lowerName.startsWith('y')) uniqueSeries.add('Vivo Y Series');
                else if (lowerName.includes('vivo s') || lowerName.includes(' s') || lowerName.startsWith('s')) uniqueSeries.add('Vivo S Series');
                else uniqueSeries.add('Vivo Other');
                return;
            }

            // 6. Realme
            if (bId === 'realme' || lowerName.includes('realme')) {
                if (lowerName.includes('gt')) uniqueSeries.add('Realme GT Series');
                else if (lowerName.includes('narzo')) uniqueSeries.add('Realme Narzo Series');
                else if (lowerName.includes('realme c') || lowerName.includes(' c') || lowerName.startsWith('c')) uniqueSeries.add('Realme C Series');
                else if (lowerName.includes('realme p') || lowerName.includes(' p') || lowerName.startsWith('p')) uniqueSeries.add('Realme P Series');
                else if (lowerName.match(/realme\s+\d+/i) || lowerName.match(/\b\d+\s*pro/i) || lowerName.match(/\b\d+\s*5g/i) || lowerName.match(/^1\d\b/)) uniqueSeries.add('Realme Number Series');
                else uniqueSeries.add('Realme Other');
                return;
            }

            // 7. Poco
            if (bId === 'poco' || lowerName.includes('poco')) {
                if (lowerName.includes('poco f') || lowerName.includes(' f') || lowerName.startsWith('f')) uniqueSeries.add('Poco F Series');
                else if (lowerName.includes('poco x') || lowerName.includes(' x') || lowerName.startsWith('x')) uniqueSeries.add('Poco X Series');
                else if (lowerName.includes('poco m') || lowerName.includes(' m') || lowerName.startsWith('m')) uniqueSeries.add('Poco M Series');
                else if (lowerName.includes('poco c') || lowerName.includes(' c') || lowerName.startsWith('c')) uniqueSeries.add('Poco C Series');
                else uniqueSeries.add('Poco Other');
                return;
            }

            // 8. iQOO
            if (bId === 'iqoo' || lowerName.includes('iqoo')) {
                if (lowerName.includes('neo')) uniqueSeries.add('iQOO Neo Series');
                else if (lowerName.includes(' z') || lowerName.startsWith('z')) uniqueSeries.add('iQOO Z Series');
                else uniqueSeries.add('iQOO Number Series');
                return;
            }

            // 9. Motorola
            if (bId === 'motorola' || bId === 'moto' || lowerName.includes('moto')) {
                if (lowerName.includes('edge')) uniqueSeries.add('Edge Series');
                else if (lowerName.includes('razr')) uniqueSeries.add('Razr Series');
                else if (lowerName.includes(' g') || lowerName.startsWith('g')) uniqueSeries.add('G Series');
                else if (lowerName.includes(' e') || lowerName.startsWith('e')) uniqueSeries.add('E Series');
                else uniqueSeries.add('Motorola Other');
                return;
            }

            // 10. Oppo
            if (bId === 'oppo' || lowerName.includes('oppo')) {
                if (lowerName.includes('find')) uniqueSeries.add('Find Series');
                else if (lowerName.includes('reno')) uniqueSeries.add('Reno Series');
                else if (lowerName.includes(' f') || lowerName.startsWith('f')) uniqueSeries.add('F Series');
                else if (lowerName.includes(' a') || lowerName.startsWith('a')) uniqueSeries.add('A Series');
                else if (lowerName.includes(' k') || lowerName.startsWith('k')) uniqueSeries.add('K Series');
                else uniqueSeries.add('Oppo Other');
                return;
            }

            // 11. Google
            if (bId === 'google' || lowerName.includes('pixel')) {
                if (lowerName.includes('fold')) uniqueSeries.add('Pixel Fold');
                else if (lowerName.match(/pixel\s+\d+a/i) || lowerName.match(/\b\d+a\b/i)) uniqueSeries.add('Pixel A Series');
                else uniqueSeries.add('Pixel Number Series');
                return;
            }
        });

        const list = Array.from(uniqueSeries).sort((a: string, b: string) => {
            // Tablet sorting (Pro > Air > mini > Standard)
            if (a.includes('iPad') && b.includes('iPad')) {
                const order = ['iPad Pro', 'iPad Air', 'iPad mini', 'iPad (Standard)'];
                return order.indexOf(a) - order.indexOf(b);
            }
            if (a.includes('Galaxy Tab') && b.includes('Galaxy Tab')) {
                const order = ['Galaxy Tab S', 'Galaxy Tab A', 'Other Galaxy Tab'];
                return order.indexOf(a) - order.indexOf(b);
            }

            // Custom Sort for OnePlus
            if (a.includes('OnePlus') && b.includes('OnePlus')) {
                const opOrder = ['OnePlus Number Series', 'OnePlus Nord Series', 'OnePlus Open Series', 'OnePlus Other'];
                const idxA = opOrder.indexOf(a);
                const idxB = opOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            }

            // Custom Sort for iPhones
            if (a === 'Air Series') return -1;
            if (b === 'Air Series') return 1;

            const numA = parseInt(a);
            const numB = parseInt(b);

            if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
            if (!isNaN(numA)) return -1;
            if (!isNaN(numB)) return 1;

            if (a === 'X Series') return -1;
            if (b === 'X Series') return 1;

            if (a === 'SE Series') return -1;
            if (b === 'SE Series') return 1;

            // Apple Watch sorting
            if ((a.includes('Watch') || a.includes('Series')) && (b.includes('Watch') || b.includes('Series'))) {
                if (a.includes('Ultra') && !b.includes('Ultra')) return -1;
                if (!a.includes('Ultra') && b.includes('Ultra')) return 1;
                
                if (a.includes('Ultra') && b.includes('Ultra')) {
                    const numA = parseInt(a.replace(/[^0-9]/g, '')) || 1;
                    const numB = parseInt(b.replace(/[^0-9]/g, '')) || 1;
                    return numB - numA;
                }

                if (a.includes('Series') && b.includes('Series')) {
                    const numA = parseInt(a.replace(/[^0-9]/g, ''));
                    const numB = parseInt(b.replace(/[^0-9]/g, ''));
                    if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
                }

                if (a.includes('SE') && !b.includes('SE')) return 1;
                if (!a.includes('SE') && b.includes('SE')) return -1;
            }

            return a.localeCompare(b);
        });

        return list.length > 1 ? list : [];
    }, [models, brandId, category]);

    // Phones: the series worked out from the model names, as in the Customer app (lib/series.ts): Realme 2 Series,
    // Realme C Series, Galaxy S Series, iPhone 15 Series, … Other categories keep the hand-made list above.
    const phoneSeries = useMemo(
        () => (category ?? 'smartphone') === 'smartphone' && models.length >= 6 ? groupSeries(brandName ?? brandId, models) : [],
        [models, brandName, brandId, category],
    );
    const [seriesOpen, setSeriesOpen] = useState(true);
    useEffect(() => {
        try { setSeriesOpen(localStorage.getItem(SERIES_PANEL_KEY) !== 'closed'); } catch { /* private mode: stays open */ }
    }, []);
    const toggleSeries = () => setSeriesOpen(open => {
        try { localStorage.setItem(SERIES_PANEL_KEY, open ? 'closed' : 'open'); } catch { /* not remembered */ }
        return !open;
    });

    // Filter Models
    const filteredModels = useMemo(() => {
        const inPhoneSeries = phoneSeries.length && activeSeries
            ? new Set(phoneSeries.find(s => s.key === activeSeries)?.modelIds ?? [])
            : null;
        const filtered = models.filter(m => {
            if (!m.name) return false;
            const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            if (inPhoneSeries) return inPhoneSeries.has(m.id);

            if (activeSeries) {
                const name = m.name.toLowerCase();

                // iPhone filters
                if (activeSeries === 'Air Series') return name.includes('air');
                if (activeSeries.includes('Series') && !isNaN(parseInt(activeSeries))) {
                    const num = parseInt(activeSeries);
                    return name.match(new RegExp(`iphone\\s+${num}\\b`, 'i'));
                }
                if (activeSeries === 'X Series') return name.includes('iphone x');
                if (activeSeries === 'SE Series') return name.includes('se');

                // iPad Filters
                if (activeSeries === 'iPad Pro') return name.includes('ipad pro');
                if (activeSeries === 'iPad Air') return name.includes('ipad air');
                if (activeSeries === 'iPad mini') return name.includes('ipad mini');
                if (activeSeries === 'iPad (Standard)') return name.includes('ipad') && !name.includes('pro') && !name.includes('air') && !name.includes('mini');

                // Galaxy Tab Filters
                if (activeSeries === 'Galaxy Tab S') return name.includes('galaxy tab s');
                if (activeSeries === 'Galaxy Tab A') return name.includes('galaxy tab a');
                if (activeSeries === 'Other Galaxy Tab') return name.includes('galaxy tab') && !name.includes('tab s') && !name.includes('tab a');

                // OnePlus Pad Filters
                if (activeSeries === 'OnePlus Pad') return name.includes('oneplus pad');

                // Realme Pad Filters
                if (activeSeries === 'Realme Pad') return name.includes('realme pad');

                // Other Tablets
                if (activeSeries === 'Xiaomi Pad') return name.includes('xiaomi pad') || name.includes('mi pad');
                if (activeSeries === 'Redmi Pad') return name.includes('redmi pad');
                if (activeSeries === 'Oppo Pad') return name.includes('oppo pad');
                if (activeSeries === 'Poco Pad') return name.includes('poco pad');
                if (activeSeries === 'Lenovo Tab') return name.includes('lenovo tab');
                if (activeSeries === 'Lenovo Yoga Tab') return name.includes('yoga tab');
                if (activeSeries === 'Moto Tab') return name.includes('moto tab') || name.includes('motorola tab');
                if (activeSeries === 'Nokia T Series') return name.includes('nokia t');

                // Galaxy Z Series (Fold & Flip)
                if (activeSeries === 'Galaxy Z Series' || activeSeries === 'Z Fold Series') return name.includes('fold');
                if (activeSeries === 'Z Flip Series') return name.includes('flip');

                // Galaxy S Series
                if (activeSeries === 'S Series' || activeSeries === 'Galaxy S Series') return (name.includes('galaxy s') || name.includes(' s2') || name.includes(' s1') || name.startsWith('s2') || name.startsWith('s1')) && !name.includes('tab');

                // Galaxy A Series
                if (activeSeries === 'A Series' || activeSeries === 'Galaxy A Series') return (name.includes('galaxy a') || name.includes(' a') || name.startsWith('a')) && !name.includes('tab');

                // Galaxy M Series
                if (activeSeries === 'M Series' || activeSeries === 'Galaxy M Series') return name.includes('galaxy m') || name.includes(' m') || name.startsWith('m');

                // Galaxy F Series
                if (activeSeries === 'F Series' || activeSeries === 'Galaxy F Series') return name.includes('galaxy f') || name.includes(' f') || name.startsWith('f');

                // Note Series
                if (activeSeries === 'Note Series') return name.includes('note');

                // Other Galaxy (Note, Core, On, etc)
                if (activeSeries === 'Other Galaxy') {
                    const isOther = !name.includes('galaxy s') && !name.includes('galaxy a') && !name.includes('galaxy m') && !name.includes('galaxy f') && !name.includes('galaxy z') && !name.includes('tab') && !name.includes('fold') && !name.includes('flip');
                    return isOther;
                }

                // Xiaomi / Redmi Filters
                if (activeSeries === 'Xiaomi Number Series') return (name.includes('xiaomi') || name.includes('mi ')) && !name.includes('pad') && !name.includes('note') && !name.includes('redmi');
                if (activeSeries === 'Redmi Note Series' || activeSeries === 'Redmi Note') return name.includes('redmi note') || name.includes('note');
                if (activeSeries === 'Redmi Number Series') return (name.includes('redmi') && !name.includes('note') && !name.includes('pad') && !name.includes('turbo') && !name.includes(' k') && !name.includes(' a')) || name.startsWith('redmi 1') || name.startsWith('redmi 2');
                if (activeSeries === 'Redmi Turbo Series') return name.includes('turbo');
                if (activeSeries === 'Redmi K Series') return name.includes(' k');
                if (activeSeries === 'Redmi A Series') return name.includes(' a');
                if (activeSeries === 'Xiaomi / Redmi Other') return (name.includes('xiaomi') || name.includes('redmi') || name.includes('mi')) && !name.includes('note') && !name.includes('pad') && !name.includes('turbo');

                // Poco Filters
                if (activeSeries === 'Poco F Series') return name.includes('poco f') || name.includes(' f') || name.startsWith('f');
                if (activeSeries === 'Poco M Series') return name.includes('poco m') || name.includes(' m') || name.startsWith('m');
                if (activeSeries === 'Poco X Series') return name.includes('poco x') || name.includes(' x') || name.startsWith('x');
                if (activeSeries === 'Poco C Series') return name.includes('poco c') || name.includes(' c') || name.startsWith('c');
                if (activeSeries === 'Poco Other') return name.includes('poco') && !name.includes('poco f') && !name.includes('poco m') && !name.includes('poco x') && !name.includes('poco c') && !name.includes('poco pad');

                // OnePlus Filters
                if (activeSeries === 'OnePlus Nord Series') return name.includes('nord') || name.includes('ce') || name.includes('n6') || name.includes('n20') || name.includes('n10') || name.includes('n100') || name.includes('n200') || name.includes('n300');
                if (activeSeries === 'OnePlus Number Series') return (name.match(/oneplus\s+\d+/i) || name.match(/\b\d+[rt]?\b/i) || name.includes(' pro')) && !name.includes('nord') && !name.includes('ce') && !name.includes('open') && !name.includes('pad');
                if (activeSeries === 'OnePlus Open Series') return name.includes('open') || name.includes('fold');
                if (activeSeries === 'OnePlus Other') return name.includes('oneplus') && !name.includes('nord') && !name.match(/oneplus\s+\d+/i) && !name.includes('ce');

                // Vivo Filters
                if (activeSeries === 'Vivo X Series') return name.includes('vivo x') || name.includes(' x') || name.startsWith('x');
                if (activeSeries === 'Vivo V Series') return name.includes('vivo v') || name.includes(' v') || name.startsWith('v');
                if (activeSeries === 'Vivo T Series') return name.includes('vivo t') || name.includes(' t') || name.startsWith('t');
                if (activeSeries === 'Vivo Y Series') return name.includes('vivo y') || name.includes(' y') || name.startsWith('y');
                if (activeSeries === 'Vivo S Series') return name.includes('vivo s') || name.includes(' s') || name.startsWith('s');
                if (activeSeries === 'Vivo Other') return name.includes('vivo') && !name.includes('vivo x') && !name.includes('vivo v') && !name.includes('vivo t') && !name.includes('vivo y') && !name.includes('vivo s');

                // Realme Filters
                if (activeSeries === 'Realme GT Series') return name.includes('gt');
                if (activeSeries === 'Realme Narzo Series') return name.includes('narzo');
                if (activeSeries === 'Realme C Series') return name.includes('realme c') || name.includes(' c') || name.startsWith('c');
                if (activeSeries === 'Realme P Series') return name.includes('realme p') || name.includes(' p') || name.startsWith('p');
                if (activeSeries === 'Realme Number Series') return name.match(/realme\s+\d+/i) || name.match(/\b\d+\s*pro/i) || name.match(/\b\d+\s*5g/i) || name.match(/^1\d\b/);
                if (activeSeries === 'Realme Other') return name.includes('realme') && !name.includes('gt') && !name.includes('narzo') && !name.includes('realme c') && !name.match(/realme\s+\d+/i);

                // iQOO Filters
                if (activeSeries === 'iQOO Neo Series') return name.includes('neo');
                if (activeSeries === 'iQOO Z Series') return name.includes(' z') || name.startsWith('z');
                if (activeSeries === 'iQOO Number Series') return name.match(/iqoo\s+\d+/i) || (!name.includes('neo') && !name.includes(' z'));
                if (activeSeries === 'iQOO Other') return name.includes('iqoo') && !name.includes('neo') && !name.includes(' z') && !name.match(/iqoo\s+\d+/i);

                // Motorola Filters
                if (activeSeries === 'Edge Series') return name.includes('edge');
                if (activeSeries === 'Razr Series') return name.includes('razr');
                if (activeSeries === 'G Series') return name.includes(' g') || name.startsWith('g');
                if (activeSeries === 'E Series') return name.includes(' e') || name.startsWith('e');
                if (activeSeries === 'Motorola Other') return !name.includes('edge') && !name.includes('razr') && !name.includes(' g') && !name.includes(' e');

                // Oppo Filters
                if (activeSeries === 'Find Series') return name.includes('find');
                if (activeSeries === 'Reno Series') return name.includes('reno');
                if (activeSeries === 'F Series') return name.includes(' f') || name.startsWith('f');
                if (activeSeries === 'A Series') return name.includes(' a') || name.startsWith('a');
                if (activeSeries === 'K Series') return name.includes(' k') || name.startsWith('k');
                if (activeSeries === 'Oppo Other') return !name.includes('find') && !name.includes('reno') && !name.includes(' f') && !name.includes(' a') && !name.includes(' k');

                // Google Filters
                if (activeSeries === 'Pixel Fold') return name.includes('fold');
                if (activeSeries === 'Pixel A Series') return name.match(/pixel\s+\d+a/i) || name.match(/\b\d+a\b/i);
                if (activeSeries === 'Pixel Number Series') return name.includes('pixel') && !name.includes('fold') && !name.match(/pixel\s+\d+a/i) && !name.match(/\b\d+a\b/i);

                // Apple Watch filters
                if (activeSeries === 'Watch Ultra') return name.includes('ultra');
                if (activeSeries === 'Watch SE') return name.includes('se');
                if (activeSeries.startsWith('Series ')) {
                    const num = activeSeries.replace('Series ', '');
                    return name.includes(`series ${num}`) && !name.includes('se');
                }
                if (activeSeries === 'Watch Series') return name.includes('apple watch') && !name.includes('series') && !name.includes('ultra') && !name.includes('se');
                
                return false; 
            }

            return true;
        });

        const dedupedList = deduplicateModels(filtered);

        return dedupedList.sort((a, b) => {
            // First check priority from database/catalog (e.g. priority 10 comes before priority 100)
            const pDiff = (a.priority ?? 100) - (b.priority ?? 100);
            if (pDiff !== 0) return pDiff;

            // Score-based sorting (latest models first within the same priority)
            const getScore = (name: string) => {
                let score = 0;
                const lower = name.toLowerCase();
                
                // iPhone score
                const iphoneMatch = lower.match(/iphone\s+(\d+)/);
                if (iphoneMatch) {
                    score = 2000 + (parseInt(iphoneMatch[1]) * 10);
                    if (lower.includes('pro max')) score += 5;
                    else if (lower.includes('pro')) score += 4;
                    else if (lower.includes('plus') || lower.includes('+')) score += 3;
                    return score;
                }

                // Apple Watch score
                if (lower.includes('watch')) {
                    if (lower.includes('ultra 2')) score = 1000;
                    else if (lower.includes('ultra')) score = 950;
                    else if (lower.includes('series')) {
                        const m = lower.match(/series\s+(\d+)/);
                        if (m) score = 800 + parseInt(m[1]);
                    } else if (lower.includes('se 2nd') || lower.includes('se 2')) {
                        score = 750;
                    } else if (lower.includes('se')) {
                        score = 700;
                    }
                    return score;
                }

                // iPad score
                if (lower.includes('ipad')) {
                    if (lower.includes('pro')) score = 1500;
                    else if (lower.includes('air')) score = 1400;
                    else if (lower.includes('mini')) score = 1300;
                    else score = 1200;
                    
                    const m = lower.match(/(\d+)(st|nd|rd|th)\s+gen/);
                    if (m) score += parseInt(m[1]);
                    return score;
                }

                // Samsung Galaxy S series score
                const sMatch = lower.match(/(?:\s|^)s(\d+)/i) || lower.match(/galaxy\s+s(\d+)/i);
                if (sMatch && !lower.includes('tab')) {
                    score = 1600 + (parseInt(sMatch[1]) * 10);
                    if (lower.includes('ultra')) score += 5;
                    else if (lower.includes('plus') || lower.includes('+')) score += 4;
                    else if (lower.includes('fe')) score -= 2;
                    return score;
                }

                // Samsung Galaxy Z Fold / Flip score
                if (lower.includes('fold')) {
                    const foldMatch = lower.match(/fold\s*(\d+)/i);
                    score = 1700 + (foldMatch ? parseInt(foldMatch[1]) * 10 : 0);
                    if (lower.includes('ultra')) score += 5;
                    return score;
                }
                if (lower.includes('flip')) {
                    const flipMatch = lower.match(/flip\s*(\d+)/i);
                    score = 1650 + (flipMatch ? parseInt(flipMatch[1]) * 10 : 0);
                    return score;
                }

                // Samsung Galaxy A series score
                const aMatch = lower.match(/(?:\s|^)a(\d+)/i) || lower.match(/galaxy\s+a(\d+)/i);
                if (aMatch && !lower.includes('tab')) {
                    score = 1300 + (parseInt(aMatch[1]) * 10);
                    return score;
                }

                // Samsung Galaxy F / M series score
                const fmMatch = lower.match(/(?:galaxy\s+|^)([fm])(\d+)/i);
                if (fmMatch) {
                    score = 1200 + (parseInt(fmMatch[2]) * 10);
                    return score;
                }

                // Vivo X / V / T / Y / S series score
                if (lower.includes('vivo')) {
                    const vxMatch = lower.match(/x(\d+)/i);
                    if (vxMatch) {
                        score = 1800 + parseInt(vxMatch[1]);
                        if (lower.includes('ultra')) score += 5;
                        else if (lower.includes('pro')) score += 4;
                        return score;
                    }
                    const vvMatch = lower.match(/v(\d+)/i);
                    if (vvMatch) {
                        score = 1600 + parseInt(vvMatch[1]);
                        if (lower.includes('pro')) score += 4;
                        return score;
                    }
                    const vtMatch = lower.match(/t(\d+)/i);
                    if (vtMatch) {
                        score = 1400 + parseInt(vtMatch[1]);
                        return score;
                    }
                    const vyMatch = lower.match(/y(\d+)/i);
                    if (vyMatch) {
                        score = 1200 + parseInt(vyMatch[1]);
                        return score;
                    }
                }

                // POCO F / X / M / C series score
                if (lower.includes('poco')) {
                    const pfMatch = lower.match(/poco\s+([fxmc])(\d+)/i);
                    if (pfMatch) {
                        const letter = pfMatch[1].toUpperCase();
                        const num = parseInt(pfMatch[2]);
                        const base = letter === 'F' ? 1700 : letter === 'X' ? 1500 : letter === 'M' ? 1300 : 1100;
                        score = base + num * 10;
                        if (lower.includes('pro')) score += 5;
                        if (lower.includes('gt')) score += 4;
                        return score;
                    }
                }

                // Redmi Note series score
                if (lower.includes('redmi note') || lower.includes('note')) {
                    const rMatch = lower.match(/note\s+(\d+)/i);
                    if (rMatch) {
                        score = 1500 + parseInt(rMatch[1]) * 10;
                        if (lower.includes('pro+') || lower.includes('pro plus')) score += 5;
                        else if (lower.includes('pro')) score += 4;
                        return score;
                    }
                }

                // Realme GT / Number / Narzo score
                if (lower.includes('realme')) {
                    if (lower.includes('gt')) {
                        const gtMatch = lower.match(/gt\s*(\d+)/i) || lower.match(/neo\s*(\d+)/i);
                        score = 1700 + (gtMatch ? parseInt(gtMatch[1]) * 10 : 0);
                        if (lower.includes('pro')) score += 5;
                        return score;
                    }
                    const rNumMatch = lower.match(/realme\s+(\d+)/i);
                    if (rNumMatch) {
                        score = 1500 + parseInt(rNumMatch[1]) * 10;
                        if (lower.includes('pro+') || lower.includes('pro plus')) score += 5;
                        else if (lower.includes('pro')) score += 4;
                        return score;
                    }
                }

                // Pixel score
                const pixelMatch = lower.match(/pixel\s+(\d+)/);
                if (pixelMatch) {
                    score = 1500 + (parseInt(pixelMatch[1]) * 10);
                    if (lower.includes('pro')) score += 5;
                    return score;
                }

                // OnePlus score
                const oneplusMatch = lower.match(/oneplus\s+(\d+)/);
                if (oneplusMatch) {
                    score = 1600 + (parseInt(oneplusMatch[1]) * 10);
                    if (lower.includes('pro')) score += 5;
                    else if (lower.includes('r')) score += 4;
                    return score;
                }
                if (lower.includes('nord') || lower.includes('ce') || lower.includes('n6')) {
                    score = 1500;
                    const nordNum = lower.match(/ce\s*(\d+)/i) || lower.match(/nord\s+(\d+)/i) || lower.match(/n(\d+)/i);
                    if (nordNum) score += parseInt(nordNum[1]) * 10;
                    return score;
                }
                
                return score;
            };

            const scoreA = getScore(a.name);
            const scoreB = getScore(b.name);

            if (scoreA !== scoreB) return scoreB - scoreA;
            return a.name.localeCompare(b.name);
        });
    }, [models, searchTerm, activeSeries, phoneSeries]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-accent rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-2xl font-bold">Select Model</h2>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search your model (e.g. iPhone 13, S23)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-card border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Phone series: tiles that fold away (remembered), like the Customer app. */}
                {phoneSeries.length > 0 && (
                    <div className="space-y-3">
                        <button onClick={toggleSeries} aria-expanded={seriesOpen}
                            className="flex w-full items-center gap-3 rounded-xl py-1 text-left">
                            <span className="flex-1">
                                <span className="block text-lg font-bold">Select series</span>
                                <span className="block text-sm text-muted-foreground">
                                    {activeSeries
                                        ? `Showing ${phoneSeries.find(s => s.key === activeSeries)?.label ?? ''}`
                                        : seriesOpen ? `${phoneSeries.length} series · pick one to narrow the list` : 'Pick a series instead of scrolling'}
                                </span>
                            </span>
                            <span className="text-sm font-bold text-primary">{seriesOpen ? 'Hide' : 'Show'}</span>
                            <ChevronDown className={`h-5 w-5 text-primary transition-transform ${seriesOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {!seriesOpen && activeSeries && (
                            <button onClick={() => setActiveSeries(null)}
                                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                                {phoneSeries.find(s => s.key === activeSeries)?.label} <X className="h-4 w-4" />
                            </button>
                        )}
                        {seriesOpen && (
                            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                                className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                                <button onClick={() => setActiveSeries(null)}
                                    className={`flex min-h-[58px] flex-col items-center justify-center rounded-xl px-2 py-2 text-center text-sm font-semibold transition-all ${!activeSeries ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'}`}>
                                    All models
                                </button>
                                {phoneSeries.map(s => (
                                    <button key={s.key} onClick={() => setActiveSeries(s.key === activeSeries ? null : s.key)}
                                        className={`flex min-h-[58px] flex-col items-center justify-center rounded-xl px-2 py-2 text-center text-sm font-semibold transition-all ${activeSeries === s.key ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'}`}>
                                        <span className="leading-tight">{s.label}</span>
                                        <span className={`text-[11px] ${activeSeries === s.key ? 'opacity-80' : 'text-muted-foreground'}`}>{s.modelIds.length}</span>
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </div>
                )}

                {/* Series Filters (other categories) */}
                {phoneSeries.length === 0 && seriesList.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="font-semibold text-lg">Choose by series</h3>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setActiveSeries(null)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${!activeSeries
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-card hover:bg-accent border-border'
                                    }`}
                            >
                                All
                            </button>
                            {seriesList.map(series => (
                                <button
                                    key={series}
                                    onClick={() => setActiveSeries(series === activeSeries ? null : series)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${activeSeries === series
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-card hover:bg-accent border-border'
                                        }`}
                                >
                                    {series}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="min-h-[300px] flex items-center justify-center">
                    <SVGLoader className="bg-transparent backdrop-blur-none w-full" />
                </div>
            ) : filteredModels.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                    <p className="text-lg font-medium">No models found</p>
                    <p className="text-sm">Try searching for something else</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredModels.map((model, index) => (
                        <motion.button
                            key={model.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => onSelect(model)}
                            className="flex flex-col items-center justify-between p-4 border rounded-xl bg-white text-black hover:border-primary hover:shadow-lg transition-all text-center h-full group"
                        >
                            <div className="relative w-full aspect-[2/3] mb-4 flex items-center justify-center bg-white rounded-lg transition-colors overflow-hidden">
                                <ModelImage
                                    src={model.img}
                                    alt={model.name}
                                    brandId={model.brandId || brandId}
                                    priority={index < 8}
                                    scale={
                                        model.name.includes('iPhone')
                                            ? (EXCLUDED_MODELS.has(model.name) ? 1 : 1.35)
                                            : (model.name.toLowerCase().includes('watch') ? 1.5 : 1.05)
                                    }
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="font-semibold text-sm line-clamp-2">
                                    {model.name.split('(')[0].trim()}
                                </span>
                            </div>
                        </motion.button>
                    ))}
                </div>
            )}
        </div>
    );
}
