
import { CheckCircle, Truck, Wallet, Loader2, MapPin, Calendar, Clock, Zap, ArrowRight, ArrowLeft, X } from "lucide-react";
import { useState, useEffect } from 'react';
import { placeOrder, checkPincodeAvailability, quotePrice, requestServiceArea } from '@/actions/orders';
import { quickRegister, quickLogin } from '@/actions/inlineAuth';
// The offer comes from quotePrice: with USE_API_ORDERS it is the server's price for this device, the price the order is booked at.
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

// Dynamic Import for Map (Client Only)
const MapPicker = dynamic(() => import('./MapPicker'), { ssr: false });

interface FinalQuoteProps {
    basePrice: number;
    answers: Record<string, unknown>;
    deviceInfo: { name: string; variant: string };
    isRepair?: boolean;
    user?: any;
    category?: string;
    onRecalculate?: () => void;
    initialPincode?: string;
    onUserLogin?: (user: any) => void;
}

type BookingStep = 'contact' | 'quote' | 'address' | 'schedule' | 'payment';

export default function FinalQuote({ basePrice, answers, deviceInfo, isRepair, user, category, onRecalculate, initialPincode, onUserLogin }: FinalQuoteProps) {
    // If repair, start at address. Else start directly at quote (Final Offer) for all users.
    const [bookingStep, setBookingStep] = useState<BookingStep>(
        isRepair ? 'address' : 'quote'
    );
    const [isSubmitting, setIsSubmitting] = useState(false);

    // User session tracking
    const [currentUser, setCurrentUser] = useState<any>(user);
    useEffect(() => {
        if (user) setCurrentUser(user);
    }, [user]);

    // Form Data
    const [phone, setPhone] = useState(user?.phone || '');
    const [address, setAddress] = useState('');
    const [pincode, setPincode] = useState(initialPincode || '');
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedDate, setSelectedDate] = useState<number>(0); // 0 to 3 index
    const [selectedSlot, setSelectedSlot] = useState<string>('');
    const [isExpress, setIsExpress] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank_transfer' | 'amazon_voucher' | 'flipkart_voucher'>('cash');
    const [upiId, setUpiId] = useState('');
    const [bankAccount, setBankAccount] = useState('');
    const [bankIfsc, setBankIfsc] = useState('');
    const [bankAccountName, setBankAccountName] = useState('');

    // UI States
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [locationError, setLocationError] = useState('');
    // State for detected address preview
    const [detectedAddress, setDetectedAddress] = useState('');
    const [isCheckingPincode, setIsCheckingPincode] = useState(false);
    const [showPincodePopup, setShowPincodePopup] = useState(false);
    const [isSendingRequest, setIsSendingRequest] = useState(false);
    const [requestSent, setRequestSent] = useState(false);
    const [requestPhone, setRequestPhone] = useState(user?.phone || '');

    // Quick Auth Modal States for Guest Checkout
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
    const [authName, setAuthName] = useState('');
    const [authPhone, setAuthPhone] = useState('');
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    const router = useRouter();

    // -------------------------------------------------------------------------
    // PRICE CALCULATION LOGIC
    // -------------------------------------------------------------------------
    const [finalPrice, setFinalPrice] = useState(0);
    const [isCalculating, setIsCalculating] = useState(true);

    useEffect(() => {
        setIsCalculating(true);
        quotePrice(deviceInfo.name, deviceInfo.variant, basePrice, answers, category || 'smartphone')
            .then(price => {
                setFinalPrice(price);
                setIsCalculating(false);
            })
            .catch(err => {
                console.error(err);
                setIsCalculating(false);
            });
    }, [basePrice, answers, category, deviceInfo.name, deviceInfo.variant]);

    // -------------------------------------------------------------------------
    // DATE GENERATION (Dynamic based on time)
    // -------------------------------------------------------------------------

    // Helper to check availability
    const now = new Date();
    const currentHour = now.getHours();

    // If past 4 PM, start dates from Tomorrow
    const startDayOffset = currentHour >= 16 ? 1 : 0;

    const dates = Array.from({ length: 4 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i + startDayOffset);
        return {
            day: d.toLocaleDateString('en-US', { weekday: 'short' }),
            date: d.getDate(),
            fullDate: d.toISOString(),
            isToday: (d.getDate() === now.getDate() && d.getMonth() === now.getMonth())
        };
    });

    const timeSlots = [
        "10:00 AM - 02:00 PM",
        "03:00 PM - 07:00 PM"
    ];

    // Filter time slots based on selection
    const availableSlots = timeSlots.filter(slot => {
        // If selected date is NOT today, all slots available
        if (!dates[selectedDate]?.isToday) return true;

        // If Today, check cutoffs
        if (slot.startsWith("10:00")) {
            // "10:00 AM - 02:00 PM": Hide after 11 AM
            return currentHour < 11;
        }
        if (slot.startsWith("03:00")) {
            // "03:00 PM - 07:00 PM": Hide after 4 PM
            return currentHour < 16;
        }
        return true;
    });

    // Express Availability: Only between 10:00 AM and 4:00 PM
    const showExpress = currentHour >= 10 && currentHour < 16;


    // -------------------------------------------------------------------------
    // HANDLERS
    // -------------------------------------------------------------------------

    const fetchAddress = async (lat: number, lng: number) => {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await response.json();
            if (data && data.display_name) {
                setDetectedAddress(data.display_name);
                // Optionally autofill main address if empty? User asked for separate preview box.
                if (!address) setAddress(data.display_name);

                // Auto-fill pincode if available and not manually set
                if (data.address && data.address.postcode && !pincode) {
                    setPincode(data.address.postcode);
                }
            }
        } catch (error) {
            console.error("Reverse geocoding failed", error);
        }
    };

    const handleGetLocation = () => {
        setIsGettingLocation(true);
        setLocationError('');
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported');
            setIsGettingLocation(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                setLocation({ lat, lng });
                await fetchAddress(lat, lng);
                setIsGettingLocation(false);
            },
            (error) => {
                console.error(error);
                let msg = 'Location failed.';
                if (error.code === 1) msg = 'Permission denied. Please allow location access.';
                else if (error.code === 2) msg = 'Location unavailable. Try again.';
                else if (error.code === 3) msg = 'Location request timed out.';

                setLocationError(msg);
                setIsGettingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleMapLocationChange = async (lat: number, lng: number) => {
        setLocation({ lat, lng });
        // Optional: Update address on drag end?
        // User said "User scan actually pinpoint their location".
        // Updating address is good UX.
        await fetchAddress(lat, lng);
    };

    const handleCheckServiceability = async () => {
        setIsCheckingPincode(true);
        try {
            const isAvailable = await checkPincodeAvailability(pincode);
            if (isAvailable) {
                setBookingStep('schedule');
            } else {
                setShowPincodePopup(true);
            }
        } catch (error) {
            console.error(error);
            // Fallback: let them proceed or show error
            setBookingStep('schedule');
        } finally {
            setIsCheckingPincode(false);
        }
    };

    const handleSendRequest = async () => {
        const phoneToSend = requestPhone.trim() || phone.trim() || currentUser?.phone || '';
        if (phoneToSend.length !== 10) return;
        setIsSendingRequest(true);
        try {
            await requestServiceArea(pincode, phoneToSend, address || detectedAddress);
            setRequestSent(true);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSendingRequest(false);
        }
    };

    const executeOrderPlacement = async (activeUser: any) => {
        setIsSubmitting(true);
        try {
            const finalAnswers = {
                ...answers,
                phone: phone || authPhone || activeUser?.phone || '',
                scheduledDate: dates[selectedDate].fullDate,
                scheduledSlot: selectedSlot,
                isExpress,
                detectedAddress,
                paymentMethod,
                upiId: paymentMethod === 'upi' ? upiId : undefined,
                bankAccount: paymentMethod === 'bank_transfer' ? bankAccount : undefined,
                bankIfsc: paymentMethod === 'bank_transfer' ? bankIfsc : undefined,
                bankAccountName: paymentMethod === 'bank_transfer' ? bankAccountName : undefined
            };

            await placeOrder(deviceInfo.name, deviceInfo.variant, finalPrice, address, pincode, location, finalAnswers);
            router.push('/orders');
        } catch (error) {
            console.error('Order placement failed:', error);
            router.push('/login');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmOrder = async () => {
        if (!currentUser) {
            if (phone) setAuthPhone(phone);
            setShowAuthModal(true);
            return;
        }
        await executeOrderPlacement(currentUser);
    };

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAuthLoading(true);
        setAuthError('');
        try {
            const formData = new FormData();
            formData.append('email', authEmail);
            formData.append('password', authPassword);
            if (authMode === 'register') {
                formData.append('name', authName);
                formData.append('phone', authPhone);
                const res = await quickRegister(formData);
                if (res.error) {
                    setAuthError(res.error);
                    setIsAuthLoading(false);
                    return;
                }
                if (res.success && res.user) {
                    setCurrentUser(res.user);
                    if (onUserLogin) onUserLogin(res.user);
                    setShowAuthModal(false);
                    await executeOrderPlacement(res.user);
                }
            } else {
                const res = await quickLogin(formData);
                if (res.error) {
                    setAuthError(res.error);
                    setIsAuthLoading(false);
                    return;
                }
                if (res.success && res.user) {
                    setCurrentUser(res.user);
                    if (onUserLogin) onUserLogin(res.user);
                    setShowAuthModal(false);
                    await executeOrderPlacement(res.user);
                }
            }
        } catch {
            setAuthError('Authentication failed. Please try again.');
        } finally {
            setIsAuthLoading(false);
        }
    };

    // -------------------------------------------------------------------------
    // RENDER: STEP 0 - PINCODE POPUP (Only for Screen Guard if missing)
    // -------------------------------------------------------------------------
    if (category === 'unbreakable-screenguard' && bookingStep === 'address' && !pincode && !isSubmitting) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="max-w-md mx-auto py-12 space-y-8"
            >
                <div className="flex items-center gap-4 mb-4">
                    <button 
                        onClick={() => {
                            if (isRepair || category === 'unbreakable-screenguard') {
                                if (onRecalculate) onRecalculate();
                            } else {
                                setBookingStep('quote');
                            }
                        }} 
                        className="p-2 hover:bg-slate-100 rounded-full dark:hover:bg-slate-800"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h2 className="text-2xl font-bold">Check Serviceability</h2>
                </div>
                <div className="text-center space-y-2">
                    <p className="text-muted-foreground">Enter your pincode to check if we serve your area.</p>
                </div>
                <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Your Pincode</label>
                        <input
                            type="text"
                            maxLength={6}
                            className="w-full p-4 border rounded-xl bg-background focus:ring-2 focus:ring-primary/50 outline-none tracking-widest text-lg"
                            placeholder="e.g. 560032"
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                if (val.length === 6) {
                                    setPincode(val);
                                }
                            }}
                            autoFocus
                        />
                    </div>
                    <button
                        disabled
                        className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        Please enter 6-digit pincode
                    </button>
                </div>
            </motion.div>
        );
    }


    // -------------------------------------------------------------------------
    // RENDER: STEP 1 - CONTACT
    // -------------------------------------------------------------------------
    if (bookingStep === 'contact') {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="max-w-md mx-auto py-12 space-y-8"
            >
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold">Almost there!</h2>
                    <p className="text-muted-foreground">Enter your number to unlock your device value.</p>
                </div>

                <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Mobile Number</label>
                        <div className="flex gap-2">
                            <div className="flex items-center justify-center px-4 bg-muted rounded-xl border font-mono text-muted-foreground">
                                +91
                            </div>
                            <input
                                type="tel"
                                maxLength={10}
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                className="flex-1 p-4 border rounded-xl bg-background focus:ring-2 focus:ring-primary/50 outline-none text-lg tracking-widest"
                                placeholder="98765 43210"
                                autoFocus
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => setBookingStep('quote')}
                        disabled={phone.length < 10}
                        className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        See Best Price <ArrowRight className="w-5 h-5" />
                    </button>

                    <p className="text-xs text-center text-muted-foreground">
                        We respect your privacy. No spam guaranteed.
                    </p>
                </div>
            </motion.div>
        );
    }

    // -------------------------------------------------------------------------
    // RENDER: STEP 2 - QUOTE
    // -------------------------------------------------------------------------
    if (bookingStep === 'quote') {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="max-w-xl mx-auto py-10 space-y-8"
            >
                <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold">Best Price for your {deviceInfo.name}</h2>
                    <p className="text-muted-foreground">Based on your condition report</p>
                </div>

                <div className="bg-gradient-to-br from-primary/10 to-accent/50 p-10 rounded-[2.5rem] border border-primary/20 text-center space-y-4 shadow-xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-3xl -z-10" />

                    <div className="inline-block px-4 py-1.5 rounded-full bg-slate-900/10 dark:bg-white/10 text-primary-dark font-bold text-sm tracking-widest uppercase mb-2">
                        Your Final Offer
                    </div>
                    <div className="text-7xl font-black text-foreground tracking-tight flex items-center justify-center gap-2">
                        {isCalculating ? <Loader2 className="w-16 h-16 animate-spin text-primary" /> : `₹${finalPrice.toLocaleString()}`}
                    </div>
                    <p className="text-sm font-medium bg-slate-900 text-white inline-block px-4 py-1.5 rounded-full shadow-md">
                        Price valid for 3 days
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => setBookingStep('address')}
                        className="w-full py-4 bg-primary text-primary-foreground font-bold text-xl rounded-2xl shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                    >
                        Book Free Pickup <Truck className="w-6 h-6" />
                    </button>
                    <button
                        onClick={() => onRecalculate ? onRecalculate() : router.back()}
                        className="w-full py-3 text-muted-foreground hover:text-foreground font-medium transition-colors"
                    >
                        Recalculate Value
                    </button>
                </div>
            </motion.div>
        );
    }

    // -------------------------------------------------------------------------
    // RENDER: STEP 3 - ADDRESS
    // -------------------------------------------------------------------------
    if (bookingStep === 'address') {
        return (
            <>
            <motion.div
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="max-w-xl mx-auto py-8 space-y-6"
            >
                <div className="flex items-center gap-4 mb-4">
                    <button 
                        onClick={() => {
                            if (isRepair || category === 'unbreakable-screenguard') {
                                if (onRecalculate) onRecalculate();
                            } else {
                                setBookingStep('quote');
                            }
                        }} 
                        className="p-2 hover:bg-slate-100 rounded-full dark:hover:bg-slate-800"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h2 className="text-2xl font-bold">{isRepair ? 'Service Location' : 'Pickup Location'}</h2>
                </div>

                <div className="bg-card border rounded-2xl p-6 space-y-6 shadow-sm">
                    <div className="space-y-3">
                        <label className="block text-sm font-medium">{isRepair ? 'Address' : 'Pickup Address'}</label>
                        <textarea
                            className="w-full p-4 border rounded-xl bg-background min-h-[120px] focus:ring-2 focus:ring-primary/50 outline-none resize-none"
                            placeholder="House No, Street Area, Landmark, City, Pincode..."
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            autoFocus
                        />
                    </div>



                    <div className="flex items-center gap-4 py-2">
                        <div className="flex-1 border-t border-dashed border-gray-300"></div>
                        <span className="text-muted-foreground font-medium text-xs uppercase">OR</span>
                        <div className="flex-1 border-t border-dashed border-gray-300"></div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-sm font-medium">Pin Location</label>
                        <button
                            onClick={handleGetLocation}
                            type="button"
                            className={`w-full py-4 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 transition-all duration-300 group ${location
                                ? 'border-green-500 bg-green-50 text-green-700'
                                : 'border-primary/30 hover:border-primary hover:bg-primary/5'
                                }`}
                        >
                            {isGettingLocation ? (
                                <><Loader2 className="animate-spin w-5 h-5" /> Detecting location...</>
                            ) : location ? (
                                <><CheckCircle className="w-5 h-5 fill-green-200" /> Location Captured</>
                            ) : (
                                <><MapPin className="w-5 h-5 group-hover:scale-110 transition-transform" /> Detect My Location</>
                            )}
                        </button>
                        {locationError && <p className="text-destructive text-sm text-center">{locationError}</p>}

                        {/* Map Preview Logic */}
                        <AnimatePresence>
                            {location && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden space-y-2 pt-2"
                                >
                                    <div className="p-3 bg-muted/50 rounded-lg border text-sm text-muted-foreground flex items-start gap-2">
                                        <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                                        <div>
                                            <span className="font-semibold block text-foreground">Detected Location:</span>
                                            {detectedAddress || "Fetching address..."}
                                        </div>
                                    </div>

                                    {/* Interactive Map */}
                                    <div className="border rounded-xl overflow-hidden shadow-sm">
                                        <MapPicker
                                            center={location}
                                            onLocationChange={handleMapLocationChange}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-border/50">
                        <label className="block text-sm font-medium">Pincode (Required)</label>
                        <input
                            type="text"
                            maxLength={6}
                            className="w-full p-4 border rounded-xl bg-background focus:ring-2 focus:ring-primary/50 outline-none"
                            placeholder="e.g. 560032"
                            value={pincode}
                            onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                        />
                    </div>
                </div>

                <button
                    onClick={handleCheckServiceability}
                    disabled={(!address && !location) || pincode.length !== 6 || isCheckingPincode}
                    className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isCheckingPincode ? <Loader2 className="animate-spin w-5 h-5" /> : <>Continue to Schedule <ArrowRight className="w-5 h-5" /></>}
                </button>
            </motion.div>
            
            {/* PINCODE NOT SERVICEABLE POPUP */}
            <AnimatePresence>
                {showPincodePopup && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-card w-full max-w-md rounded-3xl shadow-2xl border border-border/80 p-6 sm:p-7 relative overflow-hidden"
                        >
                            <button
                                onClick={() => setShowPincodePopup(false)}
                                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/80 transition-colors"
                                title="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="text-center space-y-4">
                                <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto text-amber-500 shadow-sm">
                                    <MapPin className="w-8 h-8" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-bold text-foreground">Area Not Serviceable</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        We currently do not offer pickup in pincode <span className="font-bold text-foreground font-mono bg-muted px-2 py-0.5 rounded">{pincode}</span>, but we are expanding fast!
                                    </p>
                                </div>

                                {requestSent ? (
                                    <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 p-5 rounded-2xl flex flex-col items-center gap-2 text-center my-2">
                                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                                        <p className="font-bold text-base">Request Received!</p>
                                        <p className="text-xs opacity-90 leading-relaxed">
                                            We've recorded your location and will notify you as soon as Fonzkart starts operating in {pincode}.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 text-left pt-2">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                                                Mobile Number to Notify
                                            </label>
                                            <div className="flex items-center w-full border rounded-xl bg-background overflow-hidden focus-within:ring-2 focus-within:ring-primary/50">
                                                <span className="px-3.5 py-3 bg-muted/40 text-muted-foreground text-sm font-semibold border-r border-border">+91</span>
                                                <input
                                                    type="tel"
                                                    maxLength={10}
                                                    value={requestPhone}
                                                    onChange={(e) => setRequestPhone(e.target.value.replace(/\D/g, ''))}
                                                    placeholder="9876543210"
                                                    className="w-full px-3 py-3 text-sm bg-transparent outline-none font-medium"
                                                />
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                We'll send you an alert as soon as our pickup executives reach your pincode.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col gap-2.5 pt-2">
                                    {requestSent ? (
                                        <button
                                            onClick={() => setShowPincodePopup(false)}
                                            className="w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:opacity-90 active:scale-[0.98] transition-all"
                                        >
                                            Done
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={handleSendRequest}
                                                disabled={isSendingRequest || requestPhone.length !== 10}
                                                className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {isSendingRequest ? (
                                                    <><Loader2 className="w-5 h-5 animate-spin" /> Submitting Request...</>
                                                ) : (
                                                    <>Send Request <ArrowRight className="w-5 h-5" /></>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowPincodePopup(false)}
                                                className="w-full py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                Change Pincode
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
        );
    }

    // -------------------------------------------------------------------------
    // RENDER: STEP 4 - SCHEDULE
    // -------------------------------------------------------------------------
    if (bookingStep === 'schedule') {
        return (
            <motion.div
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="max-w-xl mx-auto py-8 space-y-6"
            >
                <div className="flex items-center gap-4 mb-4">
                    <button onClick={() => setBookingStep('address')} className="p-2 hover:bg-slate-100 rounded-full">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h2 className="text-2xl font-bold">{isRepair ? 'Schedule Visit' : 'Schedule Pickup'}</h2>
                </div>

                <div className="space-y-6">

                    {/* Date Selection */}
                    <div className={`space-y-3 transition-opacity ${isExpress ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Select Date
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {dates.map((d, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        setSelectedDate(i);
                                        setIsExpress(false);
                                    }}
                                    className={`flex flex-col items-center p-3 rounded-xl border transition-all ${selectedDate === i
                                        ? 'border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20'
                                        : 'border-border bg-card hover:bg-accent'
                                        }`}
                                >
                                    <span className="text-xs opacity-80">{d.day}</span>
                                    <span className="text-lg font-bold">{d.date}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Time Slot Selection */}
                    <div className={`space-y-3 transition-opacity ${isExpress ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Select Time Slot
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {availableSlots.length > 0 ? availableSlots.map((slot) => (
                                <button
                                    key={slot}
                                    onClick={() => {
                                        setSelectedSlot(slot);
                                        setIsExpress(false);
                                    }}
                                    className={`p-4 rounded-xl border text-sm font-semibold transition-all ${selectedSlot === slot
                                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                        : 'border-border bg-card hover:bg-accent'
                                        }`}
                                >
                                    {slot}
                                </button>
                            )) : (
                                <p className="text-sm text-muted-foreground col-span-2 text-center py-4 bg-muted/20 rounded-xl">
                                    No slots available for this date.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 py-2">
                        <div className="flex-1 border-t border-dashed border-gray-300"></div>
                        <span className="text-muted-foreground font-medium text-xs uppercase">OR</span>
                        <div className="flex-1 border-t border-dashed border-gray-300"></div>
                    </div>

                    {/* Express Pickup Option */}
                    <div
                        className={`relative p-5 rounded-2xl border-2 transition-all overflow-hidden ${!showExpress ? 'border-dashed border-slate-200 bg-slate-50 opacity-80 cursor-not-allowed' :
                            isExpress ? 'border-amber-400 bg-amber-50 shadow-md transform scale-[1.02] cursor-pointer' :
                                'border-border bg-card hover:border-amber-200 opacity-90 cursor-pointer'
                            }`}
                        onClick={() => {
                            if (!showExpress) return;
                            const newState = !isExpress;
                            setIsExpress(newState);
                            if (newState) setSelectedSlot('');
                        }}
                    >
                        {isExpress && <div className="absolute top-0 right-0 bg-amber-400 text-amber-950 text-[10px] font-bold px-2 py-1 rounded-bl-xl">SELECTED</div>}
                        {!showExpress && <div className="absolute top-0 right-0 bg-slate-400 text-white text-[10px] font-bold px-2 py-1 rounded-bl-xl">UNAVAILABLE</div>}

                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isExpress ? 'bg-amber-100 text-amber-600' : !showExpress ? 'bg-slate-200 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                                <Zap className="w-6 h-6 fill-current" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <h4 className={`font-bold ${isExpress ? 'text-slate-900' : !showExpress ? 'text-muted-foreground' : 'text-foreground'}`}>{isRepair ? 'Express Service' : 'Express Pickup'}</h4>
                                    {!showExpress ? (
                                        <span className="text-xs font-bold text-slate-400">CLOSED</span>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs ${isExpress ? 'text-slate-500' : 'text-muted-foreground'} line-through`}>₹50</span>
                                            <span className="text-sm font-bold text-green-600">FREE</span>
                                        </div>
                                    )}
                                </div>
                                <p className={`text-xs mt-0.5 ${isExpress ? 'text-slate-600' : 'text-muted-foreground'}`}>
                                    {!showExpress 
                                        ? (currentHour < 10 ? "Express pickup starts at 10 AM." : "Orders after 4 PM not valid for today.") 
                                        : (isRepair ? 'Service within 3 hours' : "Pickup within 3 hours")
                                    }
                                </p>
                                {!showExpress && <p className="text-[10px] font-medium text-amber-600 mt-1">Pickup shift ends at 7 PM.</p>}
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isExpress ? 'border-amber-500 bg-amber-500' : 'border-slate-300'}`}>
                                {isExpress && <CheckCircle className="w-4 h-4 text-white" />}
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setBookingStep('payment')}
                    disabled={isSubmitting || (!selectedSlot && !isExpress)}
                    className="w-full py-4 text-xl font-bold text-white bg-green-600 rounded-xl shadow-lg hover:bg-green-700 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-8 animate-pulse hover:animate-none"
                >
                    Choose Method to Receive Cash <ArrowRight className="w-5 h-5" />
                </button>
                <p className="text-center text-xs text-muted-foreground pb-8">
                    By confirming, you agree to our Terms of Service
                </p>
            </motion.div>
        );
    }

    // -------------------------------------------------------------------------
    // RENDER: STEP 5 - PAYMENT METHOD
    // -------------------------------------------------------------------------
    return (
        <>
        <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="max-w-xl mx-auto py-8 space-y-6"
        >
            <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setBookingStep('schedule')} className="p-2 hover:bg-slate-100 rounded-full dark:hover:bg-slate-800 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold">Choose a Method to Receive Cash</h2>
            </div>

            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Choose how you would like to be paid once we pick up your device.</p>
                
                {/* Cash Option */}
                <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`w-full flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all ${
                        paymentMethod === 'cash' ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/10' : 'border-border bg-card hover:border-primary/50'
                    }`}
                >
                    <div className={`p-3 rounded-full ${paymentMethod === 'cash' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        <Wallet className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <span className="block font-bold text-lg">Instant Doorstep Cash</span>
                        <span className="text-sm text-muted-foreground">Get paid in cash instantly at your doorstep during device inspection.</span>
                    </div>
                    {paymentMethod === 'cash' && <div className="text-primary mt-1 font-bold text-xs uppercase bg-primary/10 px-2 py-1 rounded-full">Selected</div>}
                </button>

                {/* UPI Option */}
                <div className="space-y-3">
                    <button
                        onClick={() => setPaymentMethod('upi')}
                        className={`w-full flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all ${
                            paymentMethod === 'upi' ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/10' : 'border-border bg-card hover:border-primary/50'
                        }`}
                    >
                        <div className={`p-3 rounded-full ${paymentMethod === 'upi' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            <Zap className="w-6 h-6 fill-current" />
                        </div>
                        <div className="flex-1">
                            <span className="block font-bold text-lg">Instant UPI Transfer</span>
                            <span className="text-sm text-muted-foreground">Receive direct bank transfer to Google Pay, PhonePe, or Paytm UPI instantly.</span>
                        </div>
                        {paymentMethod === 'upi' && <div className="text-primary mt-1 font-bold text-xs uppercase bg-primary/10 px-2 py-1 rounded-full">Selected</div>}
                    </button>
                    
                    {paymentMethod === 'upi' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                            className="p-4 bg-muted/30 border rounded-xl space-y-2"
                        >
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Enter UPI ID (e.g. name@okhdfcbank)</label>
                            <input
                                type="text"
                                value={upiId}
                                onChange={(e) => setUpiId(e.target.value)}
                                placeholder="username@bank"
                                className="w-full h-12 px-4 rounded-xl border bg-background font-mono text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                            />
                        </motion.div>
                    )}
                </div>

                {/* Bank Transfer Option */}
                <div className="space-y-3">
                    <button
                        onClick={() => setPaymentMethod('bank_transfer')}
                        className={`w-full flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all ${
                            paymentMethod === 'bank_transfer' ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/10' : 'border-border bg-card hover:border-primary/50'
                        }`}
                    >
                        <div className={`p-3 rounded-full ${paymentMethod === 'bank_transfer' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            <Wallet className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <span className="block font-bold text-lg">Bank Account Transfer</span>
                            <span className="text-sm text-muted-foreground">Receive direct bank IMPS transfer instantly at your doorstep during pickup.</span>
                        </div>
                        {paymentMethod === 'bank_transfer' && <div className="text-primary mt-1 font-bold text-xs uppercase bg-primary/10 px-2 py-1 rounded-full">Selected</div>}
                    </button>
                    
                    {paymentMethod === 'bank_transfer' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                            className="p-5 bg-muted/30 border rounded-2xl space-y-4"
                        >
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Account Holder Name</label>
                                <input
                                    type="text"
                                    value={bankAccountName}
                                    onChange={(e) => setBankAccountName(e.target.value)}
                                    placeholder="Enter full name"
                                    className="w-full h-12 px-4 rounded-xl border bg-background text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Account Number</label>
                                    <input
                                        type="text"
                                        value={bankAccount}
                                        onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Enter account number"
                                        className="w-full h-12 px-4 rounded-xl border bg-background font-mono text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">IFSC Code</label>
                                    <input
                                        type="text"
                                        value={bankIfsc}
                                        onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                                        placeholder="SBIN0012345"
                                        className="w-full h-12 px-4 rounded-xl border bg-background font-mono text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Amazon Voucher Option */}
                <button
                    onClick={() => setPaymentMethod('amazon_voucher')}
                    className={`w-full flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all ${
                        paymentMethod === 'amazon_voucher' ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/10' : 'border-border bg-card hover:border-primary/50'
                    }`}
                >
                    <div className={`p-3 rounded-full ${paymentMethod === 'amazon_voucher' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        <CheckCircle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <span className="block font-bold text-lg">Amazon Pay Gift Voucher</span>
                        <span className="text-sm text-muted-foreground">Receive an instant Amazon Pay gift card code with 100% face value.</span>
                    </div>
                    {paymentMethod === 'amazon_voucher' && <div className="text-primary mt-1 font-bold text-xs uppercase bg-primary/10 px-2 py-1 rounded-full">Selected</div>}
                </button>

                {/* Flipkart Voucher Option */}
                <button
                    onClick={() => setPaymentMethod('flipkart_voucher')}
                    className={`w-full flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all ${
                        paymentMethod === 'flipkart_voucher' ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/10' : 'border-border bg-card hover:border-primary/50'
                    }`}
                >
                    <div className={`p-3 rounded-full ${paymentMethod === 'flipkart_voucher' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        <CheckCircle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <span className="block font-bold text-lg">Flipkart Electronic Gift Voucher</span>
                        <span className="text-sm text-muted-foreground">Receive an instant Flipkart e-gift card code directly to your email/phone.</span>
                    </div>
                    {paymentMethod === 'flipkart_voucher' && <div className="text-primary mt-1 font-bold text-xs uppercase bg-primary/10 px-2 py-1 rounded-full">Selected</div>}
                </button>
            </div>

            <button
                onClick={handleConfirmOrder}
                disabled={isSubmitting || (paymentMethod === 'upi' && !upiId) || (paymentMethod === 'bank_transfer' && (!bankAccount || !bankIfsc || !bankAccountName))}
                className="w-full h-14 text-lg font-bold text-white bg-green-600 rounded-xl shadow-lg hover:bg-green-700 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-8 shadow-green-600/10 hover:shadow-green-600/20"
            >
                {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : (isRepair ? 'Confirm Booking' : 'Confirm & Complete Order')}
            </button>
            <p className="text-center text-xs text-muted-foreground pb-8">
                By confirming, you agree to our Terms of Service
            </p>
        </motion.div>

        {/* INLINE AUTH MODAL FOR GUEST USERS */}
        <AnimatePresence>
            {showAuthModal && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="bg-card w-full max-w-md rounded-3xl shadow-2xl border border-border/80 p-6 sm:p-7 relative overflow-hidden"
                    >
                        <button
                            onClick={() => setShowAuthModal(false)}
                            className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/80 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3 text-primary">
                                <Truck className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-foreground">
                                {authMode === 'register' ? 'Confirm Your Pickup' : 'Welcome Back'}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {authMode === 'register'
                                    ? 'Please provide your details to lock in your offer and schedule pickup.'
                                    : 'Sign in to confirm your pickup request.'}
                            </p>
                        </div>

                        <form onSubmit={handleAuthSubmit} className="space-y-4">
                            {authMode === 'register' && (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Full Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={authName}
                                            onChange={(e) => setAuthName(e.target.value)}
                                            placeholder="e.g. Rahul Sharma"
                                            className="w-full px-4 py-3 rounded-xl border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Mobile Number</label>
                                        <div className="flex items-center w-full border rounded-xl bg-background overflow-hidden focus-within:ring-2 focus-within:ring-primary/50">
                                            <span className="px-3.5 py-3 bg-muted/40 text-muted-foreground text-sm font-semibold border-r border-border">+91</span>
                                            <input
                                                type="tel"
                                                required
                                                maxLength={10}
                                                value={authPhone}
                                                onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, ''))}
                                                placeholder="9876543210"
                                                className="w-full px-3 py-3 text-sm bg-transparent outline-none font-medium"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={authEmail}
                                    onChange={(e) => setAuthEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    className="w-full px-4 py-3 rounded-xl border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Password</label>
                                <input
                                    type="password"
                                    required
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 rounded-xl border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>

                            {authError && (
                                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl font-medium text-center">
                                    {authError}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isAuthLoading || (authMode === 'register' && (!authName || authPhone.length !== 10))}
                                className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                            >
                                {isAuthLoading ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Verifying...</>
                                ) : (
                                    authMode === 'register' ? 'Confirm Pickup & Complete' : 'Sign In & Confirm'
                                )}
                            </button>

                            <div className="pt-2 text-center text-xs text-muted-foreground">
                                {authMode === 'register' ? (
                                    <p>
                                        Already have an account?{' '}
                                        <button
                                            type="button"
                                            onClick={() => { setAuthMode('login'); setAuthError(''); }}
                                            className="text-primary font-bold hover:underline"
                                        >
                                            Sign In
                                        </button>
                                    </p>
                                ) : (
                                    <p>
                                        Need a new account?{' '}
                                        <button
                                            type="button"
                                            onClick={() => { setAuthMode('register'); setAuthError(''); }}
                                            className="text-primary font-bold hover:underline"
                                        >
                                            Create Account
                                        </button>
                                    </p>
                                )}
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
        </>
    );
}
