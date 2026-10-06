'use client';

import { useState, useEffect } from 'react';
import { X, IndianRupee, Camera, Smartphone, Package, Check, ArrowRight, ArrowLeft, Loader2, AlertCircle, Wallet } from 'lucide-react';
import ImageUploader from './ImageUploader';
import ChecklistWizard from '@/components/sell/ChecklistWizard';
import { calculatePrice } from '@/actions/priceCalculation';
import { findVariantByName } from '@/actions/catalog';
import ImeiScanner from './ImeiScanner';

export default function VerificationModal({ order, onClose, onSubmit }: { order: any, onClose: () => void, onSubmit: (data: any) => void }) {
    const [step, setStep] = useState<'photos' | 'conditions' | 'imei' | 'summary'>('photos');
    const [images, setImages] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    const [imei, setImei] = useState('');
    const [imei2, setImei2] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [answers, setAnswers] = useState<Record<string, unknown>>({});
    const [deviceCategory, setDeviceCategory] = useState<string>('smartphone');
    const [isCalculating, setIsCalculating] = useState(false);
    const [finalPrice, setFinalPrice] = useState(order.price);

    const initialAnswersObj = typeof order.answers === 'string'
        ? JSON.parse(order.answers)
        : (order.answers || {});

    const [paymentMethod, setPaymentMethod] = useState<string>(initialAnswersObj.paymentMethod || 'cash');
    const [upiId, setUpiId] = useState<string>(initialAnswersObj.upiId || '');
    const [bankAccount, setBankAccount] = useState<string>(initialAnswersObj.bankAccount || '');
    const [bankIfsc, setBankIfsc] = useState<string>(initialAnswersObj.bankIfsc || '');
    const [bankAccountName, setBankAccountName] = useState<string>(initialAnswersObj.bankAccountName || '');
    const [basePrice, setBasePrice] = useState<number | null>(null);
    const [isRevising, setIsRevising] = useState(false);
    const [revisedPriceInput, setRevisedPriceInput] = useState(order.price.toString());

    useEffect(() => {
        setRevisedPriceInput(finalPrice.toString());
    }, [finalPrice]);

    useEffect(() => {
        findVariantByName(order.device).then(v => {
            if (v) {
                setBasePrice(v.basePrice);
                const cat = (v as any).model?.category;
                if (cat) {
                    setDeviceCategory(cat);
                }
            }
        });
    }, [order.device]);

    const handleConditionComplete = async (newAnswers: Record<string, unknown>) => {
        setAnswers(newAnswers);
        setIsCalculating(true);
        try {
            const startPrice = basePrice || order.price;
            const calculated = await calculatePrice(startPrice, newAnswers, deviceCategory);
            setFinalPrice(calculated);
            setStep('imei');
        } catch {
            alert("Price calculation failed. Using current price.");
            setStep('imei');
        } finally {
            setIsCalculating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
            <div className="bg-background rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-white/10">
                {/* Header */}
                <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-xl">
                            <Smartphone className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">Verification Flow</h3>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mt-0.5">
                                Step {step === 'photos' ? '1' : step === 'conditions' ? '2' : step === 'imei' ? '3' : '4'} of 4
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-muted flex">
                    <div className={`h-full bg-primary transition-all duration-500 ${
                        step === 'photos' ? 'w-1/4' : step === 'conditions' ? 'w-2/4' : step === 'imei' ? 'w-3/4' : 'w-full'
                    }`} />
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {step === 'photos' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex items-start gap-4">
                                <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
                                    <Camera className="w-4 h-4" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-sm">Step 1: Device Photography</h4>
                                    <p className="text-xs text-muted-foreground">Capture front, back, and any physical damages clearly.</p>
                                </div>
                            </div>
                            <ImageUploader onUploadComplete={setImages} />
                            
                            <div className="pt-4">
                                <button
                                    onClick={() => setStep('conditions')}
                                    disabled={images.length === 0}
                                    className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                                >
                                    Proceed to Conditions <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'conditions' && (
                        <div className="animate-in fade-in slide-in-from-right-4">
                            <div className="mb-6 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-start gap-4">
                                <AlertCircle className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                                <div className="space-y-1">
                                    <h4 className="font-bold text-sm">Step 2: Conditions Check</h4>
                                    <p className="text-xs text-muted-foreground">Re-evaluate the device conditions exactly as the customer did.</p>
                                </div>
                            </div>
                            <ChecklistWizard 
                                deviceInfo={{ name: order.device, variant: '', img: '' }}
                                category={deviceCategory}
                                onComplete={handleConditionComplete}
                            />
                        </div>
                    )}

                    {step === 'imei' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            {showScanner ? (
                                <ImeiScanner 
                                    onDetected={(i1, i2) => {
                                        setImei(i1);
                                        if (i2) setImei2(i2);
                                        setShowScanner(false);
                                    }}
                                    onClose={() => setShowScanner(false)}
                                />
                            ) : (
                                <>
                                    <div className="bg-blue-500/5 p-6 rounded-3xl border border-blue-500/10 flex flex-col items-center text-center space-y-4">
                                        <div className="p-4 bg-blue-500/10 text-blue-500 rounded-2xl">
                                            <Package className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold">Step 3: IMEI Verification</h4>
                                            <p className="text-sm text-muted-foreground mt-1">Reveal the IMEI by scanning the barcode or label.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <button 
                                            onClick={() => setShowScanner(true)}
                                            className="w-full h-24 bg-primary/10 border-2 border-dashed border-primary/30 rounded-[2rem] flex flex-col items-center justify-center gap-2 hover:bg-primary/20 transition-all group"
                                        >
                                            <div className="p-2 bg-primary text-white rounded-full group-hover:scale-110 transition-transform">
                                                <Camera className="w-6 h-6" />
                                            </div>
                                            <span className="font-black text-xs uppercase tracking-[0.2em] text-primary">Open Barcode Scanner</span>
                                        </button>

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black pl-1 uppercase tracking-widest text-muted-foreground">IMEI 1 (Primary)</label>
                                                <input 
                                                    type="text" 
                                                    value={imei}
                                                    onChange={(e) => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                                    className="w-full h-14 px-5 rounded-2xl border bg-card text-lg font-mono tracking-[0.2em] outline-none focus:ring-4 focus:ring-primary/10 transition-all text-center"
                                                    placeholder="Manual Entry Fallback"
                                                />
                                            </div>

                                            {imei2 && (
                                                <div className="space-y-2 animate-in slide-in-from-top-2">
                                                    <label className="text-[10px] font-black pl-1 uppercase tracking-widest text-muted-foreground">IMEI 2 (Secondary)</label>
                                                    <input 
                                                        type="text" 
                                                        value={imei2}
                                                        onChange={(e) => setImei2(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                                        className="w-full h-14 px-5 rounded-2xl border bg-card text-lg font-mono tracking-[0.2em] outline-none focus:ring-4 focus:ring-primary/10 transition-all text-center opacity-70"
                                                        placeholder="Secondary IMEI"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-4 pt-4">
                                        <button onClick={() => setStep('conditions')} className="px-6 h-14 border-2 rounded-2xl font-bold hover:bg-muted transition-all">Back</button>
                                        <button
                                            onClick={() => setStep('summary')}
                                            disabled={imei.length < 15}
                                            className="flex-1 h-14 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                                        >
                                            Review Summary <ArrowRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {step === 'summary' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <div className="bg-emerald-500 p-8 rounded-[2.5rem] text-white space-y-4 shadow-xl shadow-emerald-500/20">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest opacity-80">Final Calculated Price</p>
                                        <div className="text-5xl font-black mt-2">₹{finalPrice.toLocaleString()}</div>
                                    </div>
                                    <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                                        <IndianRupee className="w-6 h-6" />
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-white/20 flex flex-wrap gap-4">
                                    <div className="bg-white/10 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase">IMEI 1: {imei}</div>
                                    {imei2 && <div className="bg-white/10 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase">IMEI 2: {imei2}</div>}
                                    <div className="bg-white/10 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase">{images.length} Photos</div>
                                </div>
                            </div>

                            {/* Doorstep Payout Selection */}
                            <div className="bg-muted/50 p-6 rounded-3xl border space-y-4">
                                <h4 className="font-bold text-sm text-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Wallet className="w-4 h-4 text-emerald-600" /> Doorstep Payout Method
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {[
                                        { id: 'cash', label: 'Cash Payment' },
                                        { id: 'upi', label: 'UPI Transfer' },
                                        { id: 'bank_transfer', label: 'Bank Account' },
                                        { id: 'amazon_voucher', label: 'Amazon Card' },
                                        { id: 'flipkart_voucher', label: 'Flipkart Card' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setPaymentMethod(opt.id)}
                                            className={`p-3 text-xs font-bold rounded-xl border-2 transition-all ${
                                                paymentMethod === opt.id
                                                    ? 'border-emerald-600 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-extrabold'
                                                    : 'border-border bg-card hover:bg-muted text-muted-foreground'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                {paymentMethod === 'upi' && (
                                    <div className="space-y-1.5 animate-in slide-in-from-top-1">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase">Recipient UPI ID</label>
                                        <input
                                            type="text"
                                            value={upiId}
                                            onChange={(e) => setUpiId(e.target.value)}
                                            placeholder="username@bank"
                                            className="w-full h-11 px-3 bg-card border rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                                        />
                                    </div>
                                )}
                                {paymentMethod === 'bank_transfer' && (
                                    <div className="space-y-3 animate-in slide-in-from-top-1">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-muted-foreground uppercase">Account Holder Name</label>
                                            <input
                                                type="text"
                                                value={bankAccountName}
                                                onChange={(e) => setBankAccountName(e.target.value)}
                                                placeholder="Full Name"
                                                className="w-full h-11 px-3 bg-card border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-muted-foreground uppercase">Account Number</label>
                                                <input
                                                    type="text"
                                                    value={bankAccount}
                                                    onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ''))}
                                                    placeholder="Account No"
                                                    className="w-full h-11 px-3 bg-card border rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-muted-foreground uppercase">IFSC Code</label>
                                                <input
                                                    type="text"
                                                    value={bankIfsc}
                                                    onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                                                    placeholder="SBIN0012345"
                                                    className="w-full h-11 px-3 bg-card border rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {isRevising && (
                                <div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10 space-y-3 animate-in slide-in-from-top-2">
                                    <label className="text-xs font-bold text-amber-500 uppercase tracking-wider block">Enter Revised Price (₹)</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="number"
                                            value={revisedPriceInput}
                                            onChange={(e) => setRevisedPriceInput(e.target.value)}
                                            className="flex-1 h-12 px-4 rounded-xl border bg-card text-lg font-bold outline-none focus:ring-2 focus:ring-amber-500"
                                            placeholder="Revised Price"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const parsed = parseFloat(revisedPriceInput);
                                                if (!isNaN(parsed) && parsed >= 0) {
                                                    setFinalPrice(parsed);
                                                    setIsRevising(false);
                                                } else {
                                                    alert("Please enter a valid price");
                                                }
                                            }}
                                            className="px-4 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors text-sm"
                                        >
                                            Apply
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setIsRevising(false)}
                                            className="px-3 border rounded-xl hover:bg-muted text-xs transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold pl-1 text-muted-foreground uppercase tracking-widest">Verification Notes</label>
                                    <textarea 
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full h-32 p-4 rounded-2xl border bg-card text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all resize-none"
                                        placeholder="Add any specific observations..."
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 pt-4 sticky bottom-0 bg-background py-2 border-t">
                                {/* First row: Back & Revise */}
                                <div className="flex gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => setStep('imei')} 
                                        className="flex-1 h-12 border-2 rounded-xl font-bold hover:bg-muted transition-all text-sm"
                                    >
                                        Back
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setRevisedPriceInput(finalPrice.toString());
                                            setIsRevising(!isRevising);
                                        }} 
                                        className="flex-1 h-12 border-2 border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-xl font-bold hover:bg-amber-500/5 transition-all text-sm flex items-center justify-center gap-2"
                                    >
                                        Revise Offer
                                    </button>
                                </div>
                                
                                {/* Second row: Decline & Pickup */}
                                <div className="flex gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            if (confirm("Are you sure you want to decline this pickup?")) {
                                                const updatedAnswers = {
                                                    ...answers,
                                                    paymentMethod,
                                                    upiId: paymentMethod === 'upi' ? upiId : undefined,
                                                    bankAccount: paymentMethod === 'bank_transfer' ? bankAccount : undefined,
                                                    bankIfsc: paymentMethod === 'bank_transfer' ? bankIfsc : undefined,
                                                    bankAccountName: paymentMethod === 'bank_transfer' ? bankAccountName : undefined
                                                };
                                                onSubmit({ action: 'decline', images, notes, finalOffer: finalPrice, imei, imei2, answers: updatedAnswers });
                                            }
                                        }}
                                        className="flex-1 h-14 bg-red-600 text-white font-black rounded-xl shadow-lg shadow-red-600/10 hover:bg-red-700 transition-all text-sm uppercase tracking-wider"
                                    >
                                        Decline
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            if (confirm(finalPrice !== order.price
                                                ? `The price changed from ₹${order.price.toLocaleString()} to ₹${finalPrice.toLocaleString()}. Send it for approval? Do not pay or collect the device until it is approved.`
                                                : `Confirm pickup at ₹${finalPrice.toLocaleString()}?`)) {
                                                const updatedAnswers = {
                                                    ...answers,
                                                    paymentMethod,
                                                    upiId: paymentMethod === 'upi' ? upiId : undefined,
                                                    bankAccount: paymentMethod === 'bank_transfer' ? bankAccount : undefined,
                                                    bankIfsc: paymentMethod === 'bank_transfer' ? bankIfsc : undefined,
                                                    bankAccountName: paymentMethod === 'bank_transfer' ? bankAccountName : undefined
                                                };
                                                onSubmit({ action: 'pickup', images, notes, finalOffer: finalPrice, imei, imei2, answers: updatedAnswers });
                                            }
                                        }}
                                        className="flex-[2] h-14 bg-emerald-600 text-white font-black rounded-xl shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                                    >
                                        <Check className="w-5 h-5" /> {finalPrice !== order.price ? 'Send for Approval' : 'Confirm Pickup'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
