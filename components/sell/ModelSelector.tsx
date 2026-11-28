'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from "framer-motion";
import { ArrowLeft, Search, X } from "lucide-react";
import Image from "next/image";
import { Model } from '@/lib/store';
import { fetchModels } from '@/actions/catalog';
import { deduplicateModels, resolveModelImage } from '@/lib/catalog2026';
import SVGLoader from "@/components/ui/SVGLoader";

interface ModelSelectorProps {
    brandId: string;
    category?: string;
    originalCategory?: string;
    onSelect: (model: Model) => void;
    onBack: () => void;
}

/** iPhones whose photo already fills the frame: shown at full size, since zooming them in would cut the phone off. */
const EXCLUDED_MODELS = new Set([
    "iPhone 17", "iPhone 17 Air",
    "iPhone 16 Plus", "iPhone 16", "iPhone 16e", "iPhone 16 E",
    "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
    "iPhone XS Max", "iPhone XS"
]);

/** The same, by photo: a model sharing one of these photos (iPhone Duo uses the Air's, iPhone 17e the 16e's) is not zoomed either. */
const TIGHT_PHOTOS = new Set([
    'Apple_iPhone_17.png', 'Apple_iPhone_Air.png', 'Apple_iPhone_16_Plus.png', 'Apple_iPhone_16.png', 'Apple_iPhone_16e.png',
    'Apple_iPhone_15_Pro_Max.png', 'Apple_iPhone_15_Pro.png', 'Apple_iPhone_15_Plus.png', 'Apple_iPhone_15.png',
    'Apple_iPhone_XS_Max.png', 'Apple_iPhone_XS.png',
]);
const fillsFrame = (name: string, img?: string | null) =>
    EXCLUDED_MODELS.has(name) || TIGHT_PHOTOS.has((img ?? '').split(/[?#]/)[0].split('/').pop() ?? '');

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

export default function ModelSelector({ brandId, category, originalCategory, onSelect, onBack }: ModelSelectorProps) {
    const [models, setModels] = useState<Model[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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

    // Filter Models
    const filteredModels = useMemo(() => {
        const words = searchTerm.toLowerCase();
        const filtered = models.filter(m => m.name && m.name.toLowerCase().includes(words));

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
    }, [models, searchTerm]);

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
                                            ? (fillsFrame(model.name, model.img) ? 1 : 1.35)
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
