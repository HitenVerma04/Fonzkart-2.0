import { AlertTriangle, Smartphone, FileText, Clock, Box, MapPin, User, Phone, Mail, Wallet } from 'lucide-react';
import { displayPhone, parseAnswers } from '@/lib/order-status';

interface OrderDetailsProps {
    order: {
        device: string;
        price: number;
        answers?: any;
        user?: {
            name?: string | null;
            email?: string | null;
            phone?: string | null;
        } | null;
    };
}

export default function OrderDetails({ order }: OrderDetailsProps) {
    const answers = parseAnswers(order.answers);

    // Normalize logic for older data if necessary

    const sections = [
        { label: 'Physical Condition', value: answers.physical_condition, icon: <Smartphone className="w-4 h-4" /> },
        { label: 'Body Condition', value: answers.body_condition, icon: <Smartphone className="w-4 h-4" /> },
        { label: 'Purchase Location', value: answers.purchase_location, icon: <MapPin className="w-4 h-4" /> },
        { label: 'Warranty Period', value: answers.warranty, icon: <Clock className="w-4 h-4" /> },
        { label: 'Original Bill', value: answers.bill, icon: <FileText className="w-4 h-4" /> },
        { label: 'Screen Type', value: answers.screen_type, icon: <Smartphone className="w-4 h-4" /> },
        { 
            label: 'Payout Method', 
            value: answers.paymentMethod 
                ? (
                    String(answers.paymentMethod).replace(/_/g, ' ') + 
                    (answers.paymentMethod === 'upi' && answers.upiId ? ` (${answers.upiId})` : '') +
                    (answers.paymentMethod === 'bank_transfer' && answers.bankAccount ? ` (A/C: ${answers.bankAccount}, IFSC: ${answers.bankIfsc || 'N/A'}, Name: ${answers.bankAccountName || 'N/A'})` : '')
                  ) 
                : undefined, 
            icon: <Wallet className="w-4 h-4" /> 
        },
    ];

    return (
        <div className="space-y-6">
            <div className="bg-muted/30 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="font-bold text-lg mb-1">{order.device}</h3>
                    <div className="text-2xl font-mono font-bold text-green-600">₹{order.price.toLocaleString()}</div>
                </div>

                {order.user && (
                    <div className="bg-background/50 p-3 rounded-lg border border-border/50 min-w-[200px]">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Customer Details</div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm font-bold">
                                <User className="w-3.5 h-3.5 text-primary" />
                                <span>{order.user.name || "N/A"}</span>
                            </div>
                            
                            {/* Phone FIRST */}
                            {(answers.phone || order.user.phone) && (
                                <div className="flex items-center gap-2 text-sm text-foreground">
                                    <Phone className="w-3.5 h-3.5 text-green-600" />
                                    <span className="font-bold">{displayPhone(answers.phone || order.user.phone)}</span>
                                </div>
                            )}

                            {/* Email SECOND */}
                            {order.user.email && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Mail className="w-3.5 h-3.5 text-blue-500" />
                                    <span className="truncate">{order.user.email}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sections.map((s, i) => (
                    s.value && (
                        <div key={i} className="p-3 border rounded-lg bg-card">
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                                {s.icon} {s.label}
                            </div>
                            <div className="font-semibold capitalize text-sm">
                                {String(s.value).replace(/_/g, ' ')}
                            </div>
                        </div>
                    )
                ))}
            </div>

            {/* Functional Issues */}
            {answers.functional_issues && answers.functional_issues.length > 0 ? (
                <div className="p-4 border rounded-xl bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30">
                    <div className="text-sm text-red-600 dark:text-red-400 font-bold mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Reported Issues
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {answers.functional_issues.map((issue: string) => (
                            <span key={issue} className="px-3 py-1.5 bg-white dark:bg-red-950/30 border border-gray-200 dark:border-red-800/50 rounded-lg text-sm font-bold text-gray-900 dark:text-red-200 shadow-sm capitalize">
                                {issue.replace(/_/g, ' ')}
                            </span>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="p-4 border rounded-xl bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30">
                    <div className="text-sm text-green-700 dark:text-green-400 font-bold flex items-center gap-2">
                        <CheckCircleIcon /> No Functional Issues Reported
                    </div>
                </div>
            )}

            {/* Accessories */}
            {answers.accessories && answers.accessories.length > 0 && (
                <div className="p-4 border rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30">
                    <div className="text-sm text-blue-600 dark:text-blue-400 font-bold mb-3 flex items-center gap-2">
                        <Box className="w-4 h-4" /> Accessories Included
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {answers.accessories.map((acc: string) => (
                            <span key={acc} className="px-3 py-1.5 bg-white dark:bg-blue-950/30 border border-gray-200 dark:border-blue-800/50 rounded-lg text-sm font-bold text-gray-900 dark:text-blue-200 shadow-sm capitalize">
                                {acc.replace(/_/g, ' ')}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Failure Log */}
            {answers.failLog && answers.failLog.length > 0 && (
                <div className="p-4 border rounded-xl bg-orange-50/50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30">
                    <div className="text-sm text-orange-600 dark:text-orange-400 font-bold mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Failure Log
                    </div>
                    <div className="space-y-3">
                        {answers.failLog.map((log: any, i: number) => (
                            <div key={i} className="text-xs border-b last:border-0 pb-2">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-muted-foreground">
                                        {new Date(log.date).toLocaleString()}
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/40 text-[10px] font-bold uppercase rounded">
                                        By {log.by || 'Admin'}
                                    </span>
                                </div>
                                <p className="font-semibold text-orange-900 dark:text-orange-200">
                                    {log.reason}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function CheckCircleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-circle-2 w-4 h-4"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
    )
}
