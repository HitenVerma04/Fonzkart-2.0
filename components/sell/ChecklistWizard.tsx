
import { useState, useEffect, useRef } from 'react';
import { questionnaireSteps } from '@/lib/data';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, XCircle, AlertTriangle, CheckCircle2, Smartphone } from 'lucide-react';
import * as Icons from 'lucide-react';
import Image from 'next/image';

/**
 * Options of which exactly one must be ticked when a list shows them (an iPhone's battery health is below or above
 * 85%): ticking one unticks the other. As in the apps (mobile/packages/core/src/questionnaire.ts).
 */
const ONE_OF: string[][] = [['battery_health_low', 'battery_health_high']];
/** Single choices the customer may skip, and what a skipped one counts as (device age: out of warranty). */
const SKIPPABLE: Record<string, string> = { warranty: 'no' };

type Opt = { id: string; label: string; description?: string; icon?: string; group?: string };
const requiredGroups = (options: Opt[] | undefined) => ONE_OF.filter(g => g.every(id => (options ?? []).some(o => o.id === id)));
const listAnswered = (options: Opt[] | undefined, value: unknown) =>
    requiredGroups(options).every(g => g.some(id => Array.isArray(value) && value.includes(id)));
/** Ticks or unticks an option; an option of a ONE_OF group replaces the rest of its group and stays ticked. */
const toggle = (value: unknown, id: string): string[] => {
    const list = Array.isArray(value) ? (value as string[]) : [];
    const group = ONE_OF.find(g => g.includes(id));
    if (group) return list.includes(id) ? list : [...list.filter(x => !group.includes(x)), id];
    return list.includes(id) ? list.filter(x => x !== id) : [...list, id];
};
/** The red asterisk on a question that must be answered. */
const Required = () => <span className="ml-1 text-red-500" aria-label="required">*</span>;

interface ChecklistWizardProps {
    deviceInfo: { name: string; variant: string; img: string };
    category?: string;
    onComplete: (answers: Record<string, unknown>) => void;
    onBack?: () => void;
}

export default function ChecklistWizard({ deviceInfo, category, onComplete, onBack }: ChecklistWizardProps) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, unknown>>({});
    const topRef = useRef<HTMLDivElement>(null);

    const scrollToTop = () => {
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
            if (document.documentElement) {
                document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
                document.documentElement.scrollTop = 0;
            }
            if (document.body) {
                document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
                document.body.scrollTop = 0;
            }
        }
    };

    const triggerScrollReset = () => {
        scrollToTop();
        const intervals = [10, 30, 50, 100, 150, 200, 300, 500];
        intervals.forEach(delay => {
            setTimeout(scrollToTop, delay);
        });
    };

    useEffect(() => {
        triggerScrollReset();
    }, [currentStepIndex]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // Customize steps based on device type (iPhone Battery Logic)
    const activeCategory = category === 'smartwatch' ? 'watch' : (category === 'smarttv' ? 'tv' : (category || 'smartphone'));
    let steps = (questionnaireSteps as any)[activeCategory] || (questionnaireSteps as any)['smartphone'];

    if (deviceInfo?.name?.toLowerCase().includes('iphone')) {
        steps = steps.map((step: any) => {
            if (step.id === 'functional_issues' && step.options) {
                // Create a shallow copy of options to modify "Battery"
                const newOptions = step.options.flatMap((opt: any) => {
                    if (opt.id === 'battery') {
                        return [
                            { id: 'battery_health_low', label: 'Battery Health < 85%', icon: 'Battery', group: opt.group },
                            { id: 'battery_health_high', label: 'Battery Health > 85%', icon: 'Battery', group: opt.group }
                        ];
                    }
                    return opt;
                });
                return { ...step, options: newOptions };
            }
            return step;
        });
    }

    const currentStep = steps[currentStepIndex];

    const handleAnswer = (key: string, value: unknown) => {
        setAnswers(prev => ({ ...prev, [key]: value }));
    };

    const handleBack = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
            triggerScrollReset();
        } else if (currentStepIndex === 0 && onBack) {
            onBack();
        }
    };

    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
            triggerScrollReset();
        } else {
            // A skipped device age counts as out of warranty (the server prices it the same way).
            const filled = { ...answers };
            for (const step of steps) {
                for (const key of [step.id, ...(step.sections ?? []).map((sec: Opt) => sec.id)]) {
                    if (key in SKIPPABLE && !filled[key]) filled[key] = SKIPPABLE[key];
                }
            }
            onComplete(filled);
        }
    };

    const isStepValid = () => {
        if (!currentStep) return false;
        // Require selection for single-select steps (Physical, Body, Warranty, Bill)
        if (currentStep.type === 'single-select') {
            return !!answers[currentStep.id] || currentStep.id in SKIPPABLE;
        }
        // Boolean questions? (Tablets/etc) - Require all answered?
        if (currentStep.questions) {
            // Check if all questions have a boolean answer (true or false, not undefined)
            return currentStep.questions.every((q: any) => typeof answers[q.id] === 'boolean');
        }
        if (currentStep.type === 'combined-step') {
            // Hardcoded validation for known sections in combined step, or iterate
            // Assuming warranty and bill are required single-selects
            // We can check if all single-select sections have answers
            return currentStep.sections.every((sec: any) => {
                if (sec.type === 'single-select') return !!answers[sec.id] || sec.id in SKIPPABLE;
                return listAnswered(sec.options, answers[sec.id]);
            });
        }
        // Multi-select steps are optional (can proceed with none), except a required pick such as battery health
        return listAnswered(currentStep.options, answers[currentStep.id]);
    };

    const renderIcon = (iconName: string) => {
        // Handle explicit Lucide icon names
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const IconComponent = (Icons as any)[iconName];
        if (IconComponent) {
            return <IconComponent className="w-8 h-8" />; // Increased size for better visibility
        }

        // Handle case-insensitive or snake_case conversion if needed, though we will try to use direct names in data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const PascalCase = iconName.split(/_| /).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const IconComponent2 = (Icons as any)[PascalCase];
        if (IconComponent2) {
            return <IconComponent2 className="w-8 h-8" />;
        }

        // Fallback
        return <AlertTriangle className="w-8 h-8" />;
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Content Area */}
            <div className="flex-1 bg-card border rounded-2xl p-6 md:p-10 shadow-sm">
                <h2 className="text-2xl font-bold mb-2">{currentStep.title}{currentStep.type === 'single-select' && !(currentStep.id in SKIPPABLE) ? <Required /> : null}</h2>
                <p className="text-muted-foreground mb-8">{currentStep.subtitle}</p>

                <AnimatePresence mode="wait" onExitComplete={triggerScrollReset}>
                    <motion.div
                        key={currentStep.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-8"
                    >
                        {currentStep.questions && currentStep.questions.map((q: { id: string; text: string; subtext: string }) => (
                            <div key={q.id} className="space-y-3">
                                <h3 className="font-semibold text-lg">{q.text}<Required /></h3>
                                <p className="text-sm text-muted-foreground">{q.subtext}</p>
                                <div className="flex gap-4 mt-2">
                                    <button
                                        onClick={() => handleAnswer(q.id, true)}
                                        className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${answers[q.id] === true ? 'border-primary bg-primary/5 text-primary' : 'border-input hover:border-primary/50'}`}
                                    >
                                        Yes
                                    </button>
                                    <button
                                        onClick={() => handleAnswer(q.id, false)}
                                        className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${answers[q.id] === false ? 'border-primary bg-primary/5 text-primary' : 'border-input hover:border-primary/50'}`}
                                    >
                                        No
                                    </button>
                                </div>
                            </div>
                        ))}

                        {(currentStep.type === 'multi-select' || currentStep.type === 'multi-select-grid' || currentStep.type === 'single-select') && (() => {
                            const gridClass = `grid gap-4 ${currentStep.type === 'multi-select-grid' || currentStep.type === 'single-select' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`;
                            const renderOption = (opt: { id: string; label: string; description?: string; icon?: string; group?: string }) => {
                                    const isMulti = currentStep.type !== 'single-select';
                                    const isSelected = isMulti
                                        ? (answers[currentStep.id] as string[])?.includes(opt.id)
                                        : answers[currentStep.id] === opt.id;

                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => {
                                                if (isMulti) {
                                                    handleAnswer(currentStep.id, toggle(answers[currentStep.id], opt.id));
                                                } else {
                                                    // Single select behavior
                                                    handleAnswer(currentStep.id, opt.id);
                                                }
                                            }}
                                            className={`relative flex flex-col items-start text-left p-6 border-2 rounded-xl transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-input hover:border-primary/50 hover:shadow-sm'}`}
                                        >
                                            <div className="flex w-full items-start gap-4">
                                                <div className={`p-3 rounded-full flex-shrink-0 ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                                                    <span className={isSelected ? 'text-primary' : 'text-muted-foreground'}>
                                                        {opt.icon ? renderIcon(opt.icon) : (isMulti ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />)}
                                                    </span>
                                                </div>
                                                <div className="flex-1">
                                                    <span className={`block font-bold text-lg mb-1 ${isSelected ? 'text-primary' : ''}`}>{opt.label}</span>
                                                    {/* Render Description if available */}
                                                    {opt.description && (
                                                        <span className="text-sm text-muted-foreground leading-snug block">{opt.description}</span>
                                                    )}
                                                </div>
                                                {isSelected && <div className="text-primary"><CheckCircle2 className="w-6 h-6" /></div>}
                                            </div>
                                        </button>
                                    );
                            };
                            // Problem lists come under headings (Camera, Buttons & controls, ...), like the sections of Device Details.
                            const options: { id: string; label: string; description?: string; icon?: string; group?: string }[] = currentStep.options ?? [];
                            if (!options.some(opt => opt.group)) return <div className={gridClass}>{options.map(renderOption)}</div>;
                            // Problems that fit no group (or have none) go last, under Miscellaneous.
                            const MISC = 'Miscellaneous';
                            const groups = options.reduce<{ title: string; options: typeof options }[]>((list, opt) => {
                                const title = opt.group || MISC;
                                const found = list.find(g => g.title === title);
                                if (found) found.options.push(opt);
                                else list.push({ title, options: [opt] });
                                return list;
                            }, []).sort((a, b) => Number(a.title === MISC) - Number(b.title === MISC));
                            return (
                                <div className="space-y-8">
                                    {groups.map(g => (
                                        <div key={g.title} className="space-y-4">
                                            <h3 className="font-semibold text-lg border-b pb-2">{g.title}{requiredGroups(g.options).length ? <Required /> : null}</h3>
                                            {requiredGroups(g.options).length ? <p className="-mt-2 text-sm text-muted-foreground">Choose your battery health (one is required).</p> : null}
                                            <div className={gridClass}>{g.options.map(renderOption)}</div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}

                        {currentStep.type === 'combined-step' && (
                            <div className="space-y-10">
                                {currentStep.sections.map((section: any) => (
                                    <div key={section.id} className="space-y-4">
                                        <h3 className="font-semibold text-lg border-b pb-2">
                                            {section.title}
                                            {(section.type === 'single-select' && !(section.id in SKIPPABLE)) || requiredGroups(section.options).length ? <Required /> : null}
                                        </h3>
                                        {section.id in SKIPPABLE ? <p className="-mt-2 text-sm text-muted-foreground">Leave empty if it is over 11 months old or out of warranty.</p> : null}
                                        <div className={`grid gap-4 ${section.type === 'single-select' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
                                            {section.options?.map((opt: { id: string; label: string; description?: string; icon?: string }) => {
                                                const isMulti = section.type !== 'single-select';
                                                const isSelected = isMulti
                                                    ? (answers[section.id] as string[])?.includes(opt.id)
                                                    : answers[section.id] === opt.id;

                                                return (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => {
                                                            if (isMulti) {
                                                                handleAnswer(section.id, toggle(answers[section.id], opt.id));
                                                            } else if (section.id in SKIPPABLE && answers[section.id] === opt.id) {
                                                                handleAnswer(section.id, undefined); // tap again to clear an optional choice
                                                            } else {
                                                                handleAnswer(section.id, opt.id);
                                                            }
                                                        }}
                                                        className={`relative flex flex-col items-start text-left p-4 border-2 rounded-xl transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-input hover:border-primary/50 hover:shadow-sm'}`}
                                                    >
                                                        <div className="flex w-full items-start gap-4">
                                                            <div className={`p-2 rounded-full flex-shrink-0 ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                                                                <span className={isSelected ? 'text-primary' : 'text-muted-foreground'}>
                                                                    {opt.icon ? renderIcon(opt.icon) : (isMulti ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />)}
                                                                </span>
                                                            </div>
                                                            <div className="flex-1">
                                                                <span className={`block font-bold text-base mb-1 ${isSelected ? 'text-primary' : ''}`}>{opt.label}</span>
                                                                {opt.description && (
                                                                    <span className="text-xs text-muted-foreground leading-snug block">{opt.description}</span>
                                                                )}
                                                            </div>
                                                            {isSelected && <div className="text-primary"><CheckCircle2 className="w-5 h-5" /></div>}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                <div className="mt-10 flex justify-between items-center">
                    {(currentStepIndex > 0 || onBack) ? (
                        <button
                            onClick={handleBack}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-semibold px-4 py-2 transition-colors rounded-lg hover:bg-muted"
                        >
                            <Icons.ArrowLeft className="w-5 h-5" /> Back
                        </button>
                    ) : <div></div>}
                    <button
                        onClick={handleNext}
                        disabled={!isStepValid()}
                        className={`flex items-center gap-2 px-8 py-3 rounded-lg font-bold transition-all shadow-md ${!isStepValid()
                            ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-70'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg'
                            }`}
                    >
                        Continue <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Sidebar Summary */}
            <div className="w-full lg:w-80 space-y-6">
                <div className="bg-card border rounded-2xl p-6 sticky top-24">
                    <div className="flex items-start gap-4 mb-6 pb-6 border-b">
                        <div className="w-16 h-20 relative bg-white dark:bg-muted rounded overflow-hidden flex items-center justify-center">
                            {deviceInfo.img && (deviceInfo.img.startsWith('/') || deviceInfo.img.startsWith('http')) ? (
                                <Image src={deviceInfo.img} alt={deviceInfo.name} fill className="object-contain" />
                            ) : (
                                <span className="text-xl font-bold text-gray-400">{deviceInfo.name[0]}</span>
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">{deviceInfo.name}</h3>
                            <p className="text-xs text-muted-foreground">{deviceInfo.variant}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-semibold text-sm">Device Evaluation</h4>

                        {/* Physical Condition Summary */}
                        {(answers.physical_condition as string) && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Physical Condition</p>
                                <div className="text-sm font-medium text-primary flex items-center gap-2">
                                    <Icons.Smartphone className="w-4 h-4" />
                                    {steps.find((s: any) => s.id === 'physical_condition')?.options?.find((o: any) => o.id === answers.physical_condition)?.label as string}
                                </div>
                            </div>
                        )}

                        {/* Body Condition Summary */}
                        {(answers.body_condition as string) && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Body Condition</p>
                                <div className="text-sm font-medium text-primary flex items-center gap-2">
                                    <Icons.Shield className="w-4 h-4" />
                                    {steps.find((s: any) => s.id === 'body_condition')?.options?.find((o: any) => o.id === answers.body_condition)?.label as string}
                                </div>
                            </div>
                        )}

                        {/* Functional Issues Summary */}
                        {(answers.functional_issues as string[] | undefined) && (answers.functional_issues as string[]).length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Functional Problems</p>
                                <ul className="text-sm space-y-1">
                                    {(answers.functional_issues as string[]).map((issueId: string) => {
                                        const label = (steps.find((s: any) => s.id === 'functional_issues')?.options?.find((o: any) => o.id === issueId)?.label || issueId) as string;
                                        return (
                                            <li key={issueId} className="text-red-500 flex gap-2"><Icons.AlertCircle className="w-4 h-4" /> {label}</li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        {/* Purchase Location Summary */}
                        {(answers.purchase_location as string) && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Purchase Location</p>
                                <div className="text-sm font-medium text-primary flex items-center gap-2">
                                    <Icons.MapPin className="w-4 h-4" />
                                    {steps.find((s: any) => s.id === 'device_details')?.sections?.find((sec: any) => sec.id === 'purchase_location')?.options?.find((o: any) => o.id === answers.purchase_location)?.label as string}
                                </div>
                            </div>
                        )}

                        {/* Warranty Summary */}
                        {(answers.warranty as string) && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Warranty</p>
                                <div className="text-sm font-medium text-primary flex items-center gap-2">
                                    <Icons.Clock className="w-4 h-4" />
                                    {steps.find((s: any) => s.id === 'device_details')?.sections?.find((sec: any) => sec.id === 'warranty')?.options?.find((o: any) => o.id === answers.warranty)?.label as string || 
                                     steps.find((s: any) => s.id === 'warranty')?.options?.find((o: any) => o.id === answers.warranty)?.label as string}
                                </div>
                            </div>
                        )}

                        {/* Accessories Summary */}
                        {(answers.accessories as string[] | undefined) && (answers.accessories as string[]).length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accessories Included</p>
                                <ul className="text-sm space-y-1">
                                    {(answers.accessories as string[]).map((accId: string) => {
                                        const label = (steps.find((s: any) => s.id === 'device_details')?.sections?.find((sec: any) => sec.id === 'accessories')?.options?.find((o: any) => o.id === accId)?.label || accId) as string;
                                        return (
                                            <li key={accId} className="text-primary flex gap-2 items-center"><Icons.CheckCircle2 className="w-4 h-4" /> {label}</li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        {/* Old/Other Categories Fallback (Tablet/etc using Boolean) */}
                        {category !== 'smartphone' && (
                            <div className="space-y-2">
                                <ul className="text-sm space-y-2">
                                    {answers.power === false && <li className="text-red-500 flex gap-2"><Icons.XCircle className="w-4 h-4" /> Power Issue</li>}
                                    {answers.screen === false && <li className="text-red-500 flex gap-2"><Icons.XCircle className="w-4 h-4" /> Screen Issue</li>}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
