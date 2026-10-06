'use client';

import { useState } from 'react';
import { Smartphone, Calendar, Clock, MapPin, ChevronDown, ChevronUp, CheckCircle, Package, Check, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Mock type or import from suitable place
// Assuming Order comes from a types file or we can define a loose interface here
interface OrderCardProps {
    order: any;
}

import OrderStepper from './OrderStepper';
import { ORDER_STATUS, TONE_BADGE, displayPhone, parseAnswers, payoutOf, priceReviewOf, quotedPriceOf, statusLabel, statusTone } from '@/lib/order-status';
export default function OrderCard({ order }: OrderCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const answers = parseAnswers(order.answers);

    const isExpress = !!answers.isExpress;
    const scheduledDate = answers.scheduledDate ? new Date(answers.scheduledDate) : null;
    const scheduledSlot = answers.scheduledSlot;
    const phone = answers.phone || 'N/A';

    const payout = payoutOf(order);
    const quotedPrice = quotedPriceOf(order);
    const review = priceReviewOf(order);
    const inReview = order.status === ORDER_STATUS.PRICE_REVIEW;

    // Filter out scheduling keys and the order's internal records to just show condition details
    const conditionKeys = Object.keys(answers).filter(k => !['isExpress', 'scheduledDate', 'scheduledSlot', 'phone', 'paymentMethod', 'upiId', 'bankAccount', 'bankIfsc', 'bankAccountName',
        'detectedAddress', 'hubStatus', 'hubHandoverAt', 'hubReceivedBy', 'failLog', 'restoreLog', 'adminRejectionLog', 'routingLog', 'priceReview', 'quotedPrice', 'payout'].includes(k));

    return (
        <div className={`bg-card border rounded-xl shadow-sm transition-all overflow-hidden ${isExpanded ? 'ring-2 ring-primary/20' : 'hover:border-primary/30'}`}>
            <div
                className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-lg shrink-0">
                        <Smartphone className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                            # FZK-{order.orderNumber}
                        </span>
                        <h3 className="font-bold text-lg">{order.device}</h3>

                        {/* Pickup Schedule Display */}
                        {isExpress ? (
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
                                ⚡ Express Pickup (3 Hours)
                            </div>
                        ) : (scheduledDate && scheduledSlot) ? (
                            <div className="flex flex-col gap-1 mt-1">
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span suppressHydrationWarning className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {scheduledDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {scheduledSlot.split(' - ')[0]} {/* Simplified time */}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                <span suppressHydrationWarning className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> {new Date(order.date).toLocaleDateString()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                            {inReview ? 'Revised Offer' : quotedPrice !== order.price ? 'Final Price' : 'Offered Price'}
                        </p>
                        <p className="text-xl font-bold text-primary">
                            ₹{(inReview ? (review?.requestedPrice ?? order.offeredPrice ?? order.price) : order.price)?.toLocaleString() || 0}
                        </p>
                        {(inReview || quotedPrice !== order.price) && (
                            <p className="text-xs text-muted-foreground">quoted <span className="line-through">₹{quotedPrice.toLocaleString()}</span></p>
                        )}
                    </div>
                    <div className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold ${TONE_BADGE[statusTone(order.status)]}`}>
                        {statusLabel(order.status, 'customer')}
                    </div>
                    <div className="text-primary hidden sm:flex items-center gap-1 font-semibold text-sm hover:underline">
                        <span>{isExpanded ? 'Hide Info' : 'View Info'}</span>
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                </div>
            </div>

            {/* EXPANDABLE DETAILS */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border bg-muted/30"
                    >
                        {/* Stepper tracking order status */}
                        <div className="pt-6 px-6 pb-2 border-b border-border/50">
                            <OrderStepper order={order} />
                            {order.executive?.name && !['completed', 'failed'].includes(order.status) && (
                                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm bg-card border rounded-lg p-3">
                                    <span className="text-muted-foreground">Your pickup executive:</span>
                                    <span className="font-semibold">{order.executive.name}</span>
                                    {order.executive.phone && (
                                        <a href={`tel:${order.executive.phone}`} className="font-bold text-primary hover:underline" onClick={e => e.stopPropagation()}>
                                            {order.executive.phone}
                                        </a>
                                    )}
                                </div>
                            )}
                            {inReview && (
                                <div className="mb-4 text-sm rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20 p-3 text-orange-900 dark:text-orange-200">
                                    After checking your device the executive offered <b>₹{(review?.requestedPrice ?? order.offeredPrice ?? order.price).toLocaleString()}</b> instead of ₹{quotedPrice.toLocaleString()}. Our team is reviewing it — the executive will confirm the final price with you before collecting the device.
                                </div>
                            )}
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">

                            {/* Left Column: Order & Contact Info */}
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                                        <Package className="w-4 h-4 text-primary" /> Order Information
                                    </h4>
                                    <div className="space-y-2 text-muted-foreground">
                                        <div className="flex justify-between">
                                            <span>Order Placed On:</span>
                                            <span suppressHydrationWarning className="font-medium text-foreground">{new Date(order.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Contact Number:</span>
                                            <span className="font-medium text-foreground">{phone === 'N/A' ? phone : displayPhone(phone)}</span>
                                        </div>
                                        {order.user?.email && (
                                            <div className="flex justify-between">
                                                <span>Email ID:</span>
                                                <span className="font-medium text-foreground">{order.user.email}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-primary" /> Pickup Location
                                    </h4>
                                    <div className="space-y-3">
                                        <p className="text-muted-foreground leading-relaxed bg-card p-3 rounded-lg border border-border">
                                            {order.address || "Address not provided"}
                                        </p>

                                        {(answers.detectedAddress || order.location) && (
                                            <div className="bg-muted/50 p-3 rounded-lg border border-border space-y-2">
                                                <div className="flex items-start gap-2 text-sm">
                                                    <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                                                    <div className="text-muted-foreground">
                                                        <span className="font-semibold text-foreground block">Detected Location:</span>
                                                        {answers.detectedAddress || "Location pinned on map"}
                                                    </div>
                                                </div>
                                                {order.location && (
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${order.location.lat},${order.location.lng}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                                                    >
                                                        View on Google Maps
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Condition & Details Chosen */}
                            <div>
                                <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-primary" /> Device Condition Reported
                                </h4>
                                <div className="bg-card p-4 rounded-lg border border-border space-y-4">
                                    {/* Screen Condition */}
                                    {answers.physical_condition && (
                                        <div className="flex justify-between items-start gap-4 pb-3 border-b border-border">
                                            <span className="text-muted-foreground">Screen's Physical Condition</span>
                                            <span className="font-medium text-right text-foreground max-w-[50%] capitalize">
                                                {String(answers.physical_condition).replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    )}

                                    {/* Body Condition */}
                                    {answers.body_condition && (
                                        <div className="flex justify-between items-start gap-4 pb-3 border-b border-border">
                                            <span className="text-muted-foreground">Body Condition</span>
                                            <span className="font-medium text-right text-foreground max-w-[50%] capitalize">
                                                {String(answers.body_condition).replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    )}

                                    {/* Functional Problems */}
                                    {answers.functional_issues !== undefined && (
                                        <div className="flex justify-between items-start gap-4 pb-3 border-b border-border">
                                            <span className="text-muted-foreground">Functional Problems</span>
                                            <span className="font-medium text-right text-foreground max-w-[50%]">
                                                {Array.isArray(answers.functional_issues) && answers.functional_issues.length > 0
                                                    ? answers.functional_issues.map((i: string) => i.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ')
                                                    : 'None'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Accessories */}
                                    {answers.accessories !== undefined && (
                                        <div className="flex justify-between items-start gap-4 pb-3 border-b border-border text-sm">
                                            <span className="text-muted-foreground">Accessories Included</span>
                                            <span className="font-semibold text-right text-primary max-w-[50%]">
                                                {Array.isArray(answers.accessories) && answers.accessories.length > 0
                                                    ? answers.accessories.map((i: string) => i.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ')
                                                    : 'None'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Purchase Location */}
                                    {answers.purchase_location && (
                                        <div className="flex justify-between items-start gap-4 pb-3 border-b border-border">
                                            <span className="text-muted-foreground">Purchase Location</span>
                                            <span className="font-medium text-right text-foreground max-w-[50%] capitalize">
                                                {String(answers.purchase_location).replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    )}

                                    {/* Warranty Period */}
                                    {answers.warranty && (
                                        <div className="flex justify-between items-start gap-4 pb-3 border-b border-border">
                                            <span className="text-muted-foreground">Warranty Period</span>
                                            <span className="font-medium text-right text-foreground max-w-[50%] capitalize">
                                                {String(answers.warranty).replace(/_/g, ' ').replace('months', 'Months')}
                                            </span>
                                        </div>
                                    )}

                                    {/* Payment Option */}
                                    {answers.paymentMethod && (
                                        <div className="flex justify-between items-start gap-4">
                                            <span className="text-muted-foreground">Payout Method</span>
                                            <span className="font-bold text-right text-emerald-600 dark:text-emerald-400 max-w-[65%] capitalize">
                                                {String(answers.paymentMethod).replace(/_/g, ' ')}
                                                {answers.paymentMethod === 'upi' && answers.upiId && ` (${answers.upiId})`}
                                                {answers.paymentMethod === 'bank_transfer' && answers.bankAccount && ` (A/C: ${answers.bankAccount})`}
                                            </span>
                                        </div>
                                    )}

                                    {/* Payout status */}
                                    <div className="flex justify-between items-start gap-4 pt-3 border-t border-border">
                                        <span className="text-muted-foreground">Payment Status</span>
                                        <span className={`font-bold text-right max-w-[65%] ${payout.paid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                            {payout.paid
                                                ? `Paid ₹${payout.amount.toLocaleString()} by ${payout.methodLabel}${payout.paidAt ? ` on ${new Date(payout.paidAt).toLocaleDateString()}` : ''}`
                                                : order.status === 'failed' ? 'Not applicable' : `Pending — ₹${payout.amount.toLocaleString()} by ${payout.methodLabel}`}
                                        </span>
                                    </div>

                                    {/* Fallback for anything else (like non-smartphone categories) */}
                                    {!answers.physical_condition && conditionKeys.length > 0 && conditionKeys.map(key => {
                                        const val = answers[key];
                                        const formattedKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                        let formattedValue = val;

                                        if (Array.isArray(val)) {
                                            formattedValue = val.join(', ') || 'None';
                                        } else if (typeof val === 'boolean') {
                                            formattedValue = val ? 'Yes' : 'No';
                                        }

                                        return (
                                            <div key={key} className="flex justify-between items-start gap-4 pb-2 border-b border-border last:border-0 last:pb-0">
                                                <span className="text-muted-foreground capitalize">{formattedKey}</span>
                                                <span className="font-medium text-right text-foreground max-w-[50%]">{String(formattedValue)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
