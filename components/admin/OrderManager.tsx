
'use client';

import { useState, useEffect } from 'react';
import { assignPartner, assignRider } from '@/actions/admin';
import { Rider, Order } from '@/lib/store'; // Need to export Order from store/lib
import { Calendar, MapPin, Smartphone, User, CheckCircle2, Eye, X, Download, Phone, Mail, AlertTriangle, Trash2, CheckSquare, Square, Camera, RotateCcw, Building2, Clock, Wallet, Handshake } from 'lucide-react';
import OrderDetails from '@/components/OrderDetails';
import { useRouter } from 'next/navigation';
import {
    ORDER_STATUS, TONE_BADGE, isAssignable, parseAnswers, payoutOf, displayPhone, telHref, priceReviewOf, quotedPriceOf, statusLabel, statusTone,
} from '@/lib/order-status';

import OrderStepper from '@/components/orders/OrderStepper';

/** What the signed-in staff member may do here (the server enforces the same rules: lib/order-access.ts). */
export type OrderPermissions = {
    assignPartner: boolean;
    assignRider: boolean;
    approvePrice: boolean;
    manage: boolean; // fail, restore, hub handover, mark payout paid
    bulk: boolean;
    delete: boolean;
};

export type OrderPartner = {
    id: string;
    name: string;
    phone: string | null;
    email: string;
    pincodes: string[];
    routable: boolean;
    relationshipManager?: { name: string; phone: string | null } | null;
};

const FULL_ACCESS: OrderPermissions = { assignPartner: true, assignRider: true, approvePrice: true, manage: true, bulk: true, delete: true };

/** POST an action to the single-order API; throws the server's message when it is refused. */
async function orderAction(orderId: string, body: Record<string, unknown>) {
    const res = await fetch('/api/admin/orders/' + orderId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.text()) || 'Request failed');
    return res.json();
}

async function bulkAction(body: Record<string, unknown>) {
    const res = await fetch('/api/admin/orders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.text()) || 'Request failed');
    return res.json();
}

export default function OrderManager({
    initialOrders,
    riders,
    partners = [],
    permissions = FULL_ACCESS,
    userRole = 'SUPER_ADMIN'
}: {
    initialOrders: Order[],
    riders: Rider[],
    partners?: OrderPartner[],
    permissions?: OrderPermissions,
    userRole?: string
}) {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>(initialOrders);

    const isRider = userRole === 'RIDER';
    const partnerById = new Map(partners.map(p => [p.id, p]));

    const [activeTab, setActiveTab] = useState<'to_be_assigned' | 'pending_pickup' | 'price_review' | 'completed' | 'failed'>(
        isRider ? 'pending_pickup' : 'to_be_assigned'
    );
    const [completedSubTab, setCompletedSubTab] = useState<'all' | 'pending' | 'handed_over'>('all');

    // Sync if server sends new orders (e.g. from polling or navigations)
    useEffect(() => {
        setOrders(initialOrders);
    }, [initialOrders]);

    // Auto-refresh every 30 seconds to sync with server/database
    useEffect(() => {
        const interval = setInterval(() => {
            router.refresh();
        }, 30000);
        return () => clearInterval(interval);
    }, [router]);

    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    const handleAssign = async (orderId: string, riderId: string) => {
        if (!riderId) return;
        setAssigningId(orderId);
        try {
            await assignRider(orderId, riderId);
            // Optimistically update the UI to instantly move to the new tab! (The order follows the executive's partner.)
            const rider = riders.find(r => r.id === riderId);
            setOrders(prev => prev.map(o => o.id === orderId
                ? { ...o, riderId, status: ORDER_STATUS.ASSIGNED, partnerId: rider?.partnerId ?? o.partnerId } : o));
            router.refresh();
        } catch (error: any) {
            alert(error.message || 'Failed to assign rider');
        } finally {
            setAssigningId(null);
        }
    };

    const handleAssignPartner = async (order: Order, partnerId: string) => {
        if (!partnerId || partnerId === order.partnerId) return;
        const partner = partnerById.get(partnerId);
        if (order.riderId && !confirm(`Move order FZK-${order.orderNumber} to ${partner?.name || 'this partner'}? The current executive will be released.`)) return;
        setAssigningId(order.id);
        try {
            await assignPartner(order.id, partnerId);
            setOrders(prev => prev.map(o => o.id === order.id
                ? { ...o, partnerId, ...(o.riderId ? { riderId: null, status: ORDER_STATUS.PENDING } : {}) } : o));
            router.refresh();
        } catch (error: any) {
            alert(error.message || 'Failed to assign partner');
        } finally {
            setAssigningId(null);
        }
    };

    const handleDecidePrice = async (order: Order, approve: boolean) => {
        try {
            if (approve) {
                const priceInput = window.prompt("Approve the revised price. Adjust the final price if needed:", order.offeredPrice?.toString() || order.price.toString());
                if (priceInput === null) return;
                const overridePrice = parseInt(priceInput, 10);
                if (isNaN(overridePrice) || overridePrice < 0) {
                    alert("Invalid price entered.");
                    return;
                }
                if (!confirm(`Approve with final price of ₹${overridePrice}? The executive will then pay the customer and collect the device.`)) return;
                await orderAction(order.id, { action: 'approve_verification', overridePrice });
            } else {
                const reason = window.prompt("Reject the revised price. Reason or acceptable price range for the executive:", "Recheck physical condition or offer max 12000");
                if (reason === null) return;
                await orderAction(order.id, { action: 'reject_verification', reason });
            }
            router.refresh();
        } catch (error: any) {
            alert(error.message || 'Failed to save the decision');
        }
    };

    const handleMarkPaid = async (order: Order) => {
        const payout = payoutOf(order);
        const reference = window.prompt(
            `Record that the customer was paid ₹${payout.amount.toLocaleString()} by ${payout.methodLabel}.\n` +
            'Reference (transaction or gift-card order ID — NOT the gift card code). Leave empty for cash:', '');
        if (reference === null) return;
        try {
            await orderAction(order.id, { action: 'mark_payout_paid', reference });
            router.refresh();
        } catch (error: any) {
            alert(error.message || 'Failed to record the payout');
        }
    };

    const handleFailOrder = async (order: Order) => {
        const reason = window.prompt("Mark order as FAILED. Reason:", "Customer unavailable");
        if (reason === null) return;
        if (!confirm("Are you sure you want to fail this order?")) return;
        try {
            await orderAction(order.id, { action: 'fail_order', reason });
            router.refresh();
        } catch (error: any) {
            alert(error.message || 'Failed to fail the order');
        }
    };

    // Sort by date desc
    const sortedOrders = [...orders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const isOpen = (o: Order) => o.status !== 'completed' && o.status !== 'failed';
    const toBeAssignedOrders = sortedOrders.filter(o => !o.riderId && isOpen(o));
    const priceReviewOrders = sortedOrders.filter(o => o.status === ORDER_STATUS.PRICE_REVIEW);
    const pendingPickupOrders = sortedOrders.filter(o => o.riderId && isOpen(o) && o.status !== ORDER_STATUS.PRICE_REVIEW);
    const completedOrders = sortedOrders.filter(o => o.status === 'completed');
    const failedOrders = sortedOrders.filter(o => o.status === 'failed');

    const handoverPendingOrders = completedOrders.filter(o => {
        const ans = parseAnswers(o.answers);
        return ans?.hubStatus !== 'handed_over';
    });
    const handedOverOrders = completedOrders.filter(o => {
        const ans = parseAnswers(o.answers);
        return ans?.hubStatus === 'handed_over';
    });

    const filteredCompletedOrders = completedSubTab === 'pending'
        ? handoverPendingOrders
        : completedSubTab === 'handed_over'
            ? handedOverOrders
            : completedOrders;

    const displayedOrders = activeTab === 'to_be_assigned'
        ? toBeAssignedOrders
        : activeTab === 'pending_pickup'
            ? pendingPickupOrders
            : activeTab === 'price_review'
                ? priceReviewOrders
            : activeTab === 'completed'
                ? filteredCompletedOrders
                : failedOrders;

    const handleBulkFail = async () => {
        if (selectedOrderIds.length === 0) return;
        const reason = window.prompt(`Mark ${selectedOrderIds.length} orders as FAILED. Reason:`, "Bulk failure");
        if (reason === null) return;
        if (!confirm(`Are you sure you want to fail ${selectedOrderIds.length} orders?`)) return;

        setIsBulkProcessing(true);
        try {
            await bulkAction({ action: 'bulk_fail', ids: selectedOrderIds, reason });
            setSelectedOrderIds([]);
            window.location.reload();
        } catch (error: any) {
            alert(error.message || 'Failed to process bulk fail');
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleBulkRestore = async () => {
        if (selectedOrderIds.length === 0) return;
        if (!confirm(`Restore ${selectedOrderIds.length} failed orders back to active status?`)) return;

        setIsBulkProcessing(true);
        try {
            await bulkAction({ action: 'bulk_restore', ids: selectedOrderIds });
            setSelectedOrderIds([]);
            window.location.reload();
        } catch (error: any) {
            alert(error.message || 'Failed to process bulk restore');
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleBulkHubHandover = async () => {
        if (selectedOrderIds.length === 0) return;
        if (!confirm(`Mark ${selectedOrderIds.length} completed orders as Handed Over to Hub?`)) return;

        setIsBulkProcessing(true);
        try {
            await bulkAction({ action: 'bulk_hub_handover', ids: selectedOrderIds, hubStatus: 'handed_over' });
            setSelectedOrderIds([]);
            window.location.reload();
        } catch (error: any) {
            alert(error.message || 'Failed to process bulk hub handover');
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedOrderIds.length === 0) return;
        if (!confirm(`CAUTION: This will PERMANENTLY delete ${selectedOrderIds.length} orders. Proceed?`)) return;

        setIsBulkProcessing(true);
        try {
            await bulkAction({ action: 'bulk_delete', ids: selectedOrderIds });
            setSelectedOrderIds([]);
            window.location.reload();
        } catch (error: any) {
            alert(error.message || 'Failed to process bulk delete');
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleRestoreOrder = async (orderId: string) => {
        if (!confirm("Restore this failed order back to active status?")) return;
        try {
            const res = await fetch('/api/admin/orders/' + orderId, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'restore_order' })
            });
            if (res.ok) {
                window.location.reload();
            } else {
                alert("Failed to restore order");
            }
        } catch {
            alert("Error restoring order");
        }
    };

    const handleUpdateHubStatus = async (orderId: string, hubStatus: 'handed_over' | 'pending') => {
        const msg = hubStatus === 'handed_over'
            ? "Confirm that this device has been handed over to the Hub?"
            : "Revert this device to Handover Pending?";
        if (!confirm(msg)) return;
        try {
            const res = await fetch('/api/admin/orders/' + orderId, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_hub_status', hubStatus })
            });
            if (res.ok) {
                window.location.reload();
            } else {
                alert("Failed to update hub status");
            }
        } catch {
            alert("Error updating hub status");
        }
    };

    const handleDeleteOrder = async (orderId: string) => {
        if (!confirm("Are you sure you want to permanently delete this order? This action cannot be undone.")) return;
        try {
            const res = await fetch('/api/admin/orders/' + orderId, {
                method: 'DELETE'
            });
            if (res.ok) {
                window.location.reload();
            } else {
                alert("Failed to delete order");
            }
        } catch {
            alert("Error deleting order");
        }
    };

    const toggleSelectAll = () => {
        if (selectedOrderIds.length === displayedOrders.length) {
            setSelectedOrderIds([]);
        } else {
            setSelectedOrderIds(displayedOrders.map(o => o.id));
        }
    };

    const toggleSelectOrder = (id: string) => {
        setSelectedOrderIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleExport = () => {
        const headers = ["Order #", "Date", "Device", "Price", "Status", "Contact", "Address", "Partner", "Rider Assigned", "Payout"];
        const rows = displayedOrders.map(o => {
            const answers = parseAnswers(o.answers);
            const phone = answers.phone || "N/A";
            const isExpress = answers.isExpress ? "Express" : "Standard";
            const riderAssign = riders.find(r => r.id === o.riderId)?.name || "Unassigned";
            return [
                `FZK-${o.orderNumber || ''}`,
                new Date(o.date).toLocaleDateString(),
                `"${o.device.replace(/"/g, '""')}"`,
                o.price,
                o.status,
                phone,
                `"${o.address.replace(/"/g, '""')}"`,
                `"${(partnerById.get(o.partnerId || '')?.name || 'Unrouted').replace(/"/g, '""')}"`,
                riderAssign,
                `${payoutOf(o).paid ? 'Paid' : 'Due'} (${payoutOf(o).methodLabel})`
            ].join(",");
        });

        const csvString = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Fonzkart_Orders_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex flex-wrap bg-muted/50 p-1 rounded-lg border border-border/50 gap-1">
                        <button
                            onClick={() => setActiveTab('to_be_assigned')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'to_be_assigned' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            To Be Assigned <span className="ml-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{toBeAssignedOrders.length}</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('pending_pickup')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'pending_pickup' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            In Progress <span className="ml-1.5 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">{pendingPickupOrders.length}</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('price_review')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'price_review' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Price Approval <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs ${priceReviewOrders.length > 0 ? 'bg-orange-500 text-white animate-pulse' : 'bg-orange-100 text-orange-700'}`}>{priceReviewOrders.length}</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('completed')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'completed' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Completed <span className="ml-1.5 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">{completedOrders.length}</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('failed')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'failed' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Failed <span className="ml-1.5 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">{failedOrders.length}</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {permissions.bulk && selectedOrderIds.length > 0 && (
                            <div className="flex items-center gap-2 bg-muted p-1 rounded-lg border mr-2 animate-in fade-in slide-in-from-right-4">
                                <span className="text-xs font-bold px-2 text-muted-foreground">{selectedOrderIds.length} selected</span>
                                
                                {(activeTab === 'to_be_assigned' || activeTab === 'pending_pickup' || activeTab === 'price_review') && (
                                    <button
                                        onClick={handleBulkFail}
                                        disabled={isBulkProcessing}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-md text-xs font-bold hover:bg-red-200 transition-colors disabled:opacity-50"
                                    >
                                        <AlertTriangle className="w-3.5 h-3.5" /> Fail Selected
                                    </button>
                                )}

                                {activeTab === 'completed' && (
                                    <>
                                        <button
                                            onClick={handleBulkHubHandover}
                                            disabled={isBulkProcessing}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                        >
                                            <Building2 className="w-3.5 h-3.5" /> Mark Handed Over to Hub
                                        </button>
                                        {permissions.delete && (<button
                                            onClick={handleBulkDelete}
                                            disabled={isBulkProcessing}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-md text-xs font-bold hover:bg-red-200 transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                                        </button>)}
                                    </>
                                )}

                                {activeTab === 'failed' && (
                                    <>
                                        <button
                                            onClick={handleBulkRestore}
                                            disabled={isBulkProcessing}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" /> Restore Selected
                                        </button>
                                        {permissions.delete && (<button
                                            onClick={handleBulkDelete}
                                            disabled={isBulkProcessing}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white rounded-md text-xs font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
                                        </button>)}
                                    </>
                                )}

                                <button
                                    onClick={() => setSelectedOrderIds([])}
                                    className="p-1.5 hover:bg-background rounded-md text-muted-foreground transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-sm shrink-0"
                        >
                            <Download className="w-4 h-4" /> Export CSV
                        </button>
                    </div>
                </div>

                {/* Sub-filters for Completed Orders: Hub Handover State */}
                {activeTab === 'completed' && (
                    <div className="flex flex-wrap items-center gap-2 p-1 bg-muted/40 rounded-lg border border-border/40 w-fit text-xs">
                        <span className="text-muted-foreground font-semibold px-2 uppercase tracking-wider text-[10px]">Hub Handover:</span>
                        <button
                            onClick={() => setCompletedSubTab('all')}
                            className={`px-3 py-1.5 rounded-md font-bold transition-all ${completedSubTab === 'all' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            All Completed ({completedOrders.length})
                        </button>
                        <button
                            onClick={() => setCompletedSubTab('pending')}
                            className={`px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 ${completedSubTab === 'pending' ? 'bg-amber-100 text-amber-800 shadow-xs dark:bg-amber-950 dark:text-amber-200' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Handover Pending ({handoverPendingOrders.length})
                        </button>
                        <button
                            onClick={() => setCompletedSubTab('handed_over')}
                            className={`px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 ${completedSubTab === 'handed_over' ? 'bg-emerald-100 text-emerald-800 shadow-xs dark:bg-emerald-950 dark:text-emerald-200' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                            Handed Over to Hub ({handedOverOrders.length})
                        </button>
                    </div>
                )}
            </div>

            {displayedOrders.length > 0 && (
                <div className="flex items-center gap-2 px-2 pb-2">
                    <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {selectedOrderIds.length === displayedOrders.length ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                            <Square className="w-4 h-4" />
                        )}
                        {selectedOrderIds.length === displayedOrders.length ? "Deselect All" : "Select All Current"}
                    </button>
                </div>
            )}
            {displayedOrders.length === 0 ? (
                <div className="text-center py-10 border rounded-xl bg-card text-muted-foreground">
                    No orders found in this category.
                </div>
            ) : (
                <div className="grid gap-4">
                    {displayedOrders.map((order) => {
                        const isSelected = selectedOrderIds.includes(order.id);
                        const assignedRider = riders.find(r => r.id === order.riderId);
                        const answers = parseAnswers(order.answers);
                        const phone = answers.phone;

                        return (
                            <div key={order.id} className="bg-card border rounded-xl p-6 flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleSelectOrder(order.id);
                                            }}
                                            className={`transition-all ${isSelected ? 'text-primary scale-110' : 'text-muted-foreground opacity-50 hover:opacity-100'}`}
                                        >
                                            {isSelected ? <CheckSquare className="w-5 h-5 shadow-sm" /> : <Square className="w-5 h-5" />}
                                        </button>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${TONE_BADGE[statusTone(order.status)]}`}>
                                            {statusLabel(order.status)}
                                        </span>
                                        {(order.status === ORDER_STATUS.PICKED_UP || order.status === ORDER_STATUS.COMPLETED) && (
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${payoutOf(order).paid ? TONE_BADGE.green : TONE_BADGE.amber}`}>
                                                {payoutOf(order).paid ? 'Paid' : 'Payout due'}
                                            </span>
                                        )}
                                        <span suppressHydrationWarning className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(order.date).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold flex flex-col items-start gap-1">
                                        <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-widest block"># FZK-{order.orderNumber}</span>
                                        <span className="flex items-center gap-2">
                                            <Smartphone className="w-5 h-5 text-gray-500" />
                                            {order.device}
                                        </span>
                                    </h3>

                                    {/* Pickup Schedule Badge */}
                                    {(() => {
                                        const isExpress = !!answers.isExpress;
                                        const scheduledDate = answers.scheduledDate ? new Date(answers.scheduledDate) : null;
                                        const scheduledSlot = answers.scheduledSlot;

                                        if (isExpress) {
                                            return (
                                                <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 w-fit">
                                                    ⚡ Express Pickup (3H)
                                                </div>
                                            );
                                        }

                                        if (scheduledDate && scheduledSlot) {
                                            return (
                                                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-3 bg-muted/50 w-fit px-2 py-1 rounded">
                                                    <span suppressHydrationWarning className="flex items-center gap-1 font-medium text-foreground">
                                                        <Calendar className="w-3 h-3" />
                                                        {scheduledDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                                                        {scheduledSlot}
                                                    </span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                    <div className="text-lg font-mono font-bold text-green-600">
                                        ₹{order.price.toLocaleString()}
                                        {quotedPriceOf(order) !== order.price && (
                                            <span className="ml-2 text-xs font-sans font-medium text-muted-foreground">
                                                (quoted <span className="line-through">₹{quotedPriceOf(order).toLocaleString()}</span>, revised price approved)
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2 mt-4">
                                        <div className="bg-muted/30 p-3 rounded-xl border border-border/50 space-y-2">
                                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Customer Details</div>
                                            {order.user && (
                                                <>
                                                    <div className="flex items-center gap-2 text-sm text-foreground">
                                                        <User className="w-4 h-4 text-primary" />
                                                        <span className="font-semibold">{order.user.name || "N/A"}</span>
                                                    </div>
                                                    
                                                    {/* Contact Number FIRST */}
                                                    {(phone || order.user.phone) && (
                                                        <div className="flex items-center gap-2 text-sm text-foreground flex-wrap">
                                                            <Phone className="w-4 h-4 text-primary" />
                                                            <a href={telHref(phone || order.user.phone)} className="font-bold tracking-wide hover:underline">{displayPhone(phone || order.user.phone)}</a>
                                                            <a href={telHref(phone || order.user.phone)} className="px-2 py-0.5 rounded-md bg-green-600 text-white text-[11px] font-bold hover:bg-green-700">Call</a>
                                                            <a href={`https://wa.me/91${String(phone || order.user.phone).replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noopener noreferrer" className="px-2 py-0.5 rounded-md border border-green-600 text-green-700 text-[11px] font-bold hover:bg-green-50">WhatsApp</a>
                                                        </div>
                                                    )}

                                                    {/* Email SECOND */}
                                                    {order.user.email && (
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <Mail className="w-4 h-4 text-primary" />
                                                            <a href={`mailto:${order.user.email}?subject=${encodeURIComponent(`Your Fonzkart order FZK-${order.orderNumber}`)}`} className="hover:underline">{order.user.email}</a>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            {(!order.user && !phone) && (
                                                <div className="text-sm text-muted-foreground italic">No details available</div>
                                            )}
                                        </div>
                                        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border/50">
                                            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                                            <span>{order.address || "Location captured via GPS"}</span>
                                        </div>
                                        {order.pincode && (
                                            <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border/50 mt-2">
                                                <span className="font-bold">Pincode:</span>
                                                <span>{order.pincode}</span>
                                            </div>
                                        )}
                                        {(() => {
                                            const partner = order.partnerId ? partnerById.get(order.partnerId) : null;
                                            return (
                                                <div className="flex items-start gap-2 text-sm bg-indigo-50/60 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40 mt-2">
                                                    <Handshake className="w-4 h-4 mt-0.5 shrink-0 text-indigo-600" />
                                                    {partner ? (
                                                        <div className="space-y-0.5">
                                                            <div><span className="text-muted-foreground">Partner:</span> <span className="font-semibold">{partner.name}</span></div>
                                                            {partner.phone && (
                                                                <a href={`tel:${partner.phone}`} className="text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline">Call partner {partner.phone}</a>
                                                            )}
                                                            {partner.relationshipManager && (
                                                                <div className="text-xs text-muted-foreground">RM: {partner.relationshipManager.name}{partner.relationshipManager.phone ? ` (${partner.relationshipManager.phone})` : ''}</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">{order.partnerId ? 'Routed to a partner outside your list' : 'Not routed to a partner yet'}</span>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    <button
                        onClick={() => setViewingOrder(order)}
                                        className="text-sm font-medium text-primary hover:underline flex items-center gap-1 mt-1"
                                    >
                                        <Eye className="w-4 h-4" /> View Evaluation Details
                                    </button>
                                </div>

                                <div className="w-full lg:w-auto min-w-[300px] border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 lg:pl-6 space-y-4">
                                    {/* Action Column for Unassigned / In Progress orders */}
                                    {!isRider && order.status !== 'completed' && order.status !== 'failed' && (
                                        <div className="space-y-3">
                                            {/* Routing: RMs, zonal heads and admins choose the partner (auto-set from the pincode at booking). */}
                                            {permissions.assignPartner && isAssignable(order.status) && (
                                                <div>
                                                    <label className="text-sm font-medium mb-1 block text-slate-500 uppercase tracking-tighter text-[10px]">
                                                        {order.partnerId ? 'Partner (reassign)' : 'Assign Partner'}
                                                    </label>
                                                    <select
                                                        className="w-full p-2 border rounded-lg bg-background text-sm"
                                                        value={order.partnerId && partnerById.get(order.partnerId)?.routable ? order.partnerId : ""}
                                                        onChange={(e) => handleAssignPartner(order, e.target.value)}
                                                        disabled={assigningId === order.id}
                                                    >
                                                        <option value="">{order.partnerId ? (partnerById.get(order.partnerId)?.name || 'Current partner') : 'Select Partner...'}</option>
                                                        {partners.filter(p => p.routable)
                                                            .sort((a, b) => Number(!!order.pincode && b.pincodes.includes(order.pincode)) - Number(!!order.pincode && a.pincodes.includes(order.pincode)))
                                                            .map(p => (
                                                                <option key={p.id} value={p.id}>
                                                                    {p.name}{order.pincode && p.pincodes.includes(order.pincode) ? ' (covers this pincode)' : ''}
                                                                </option>
                                                            ))}
                                                    </select>
                                                </div>
                                            )}

                                            {permissions.assignRider && isAssignable(order.status) && (
                                                <div>
                                                    <label className="text-sm font-medium mb-1 block text-slate-500 uppercase tracking-tighter text-[10px]">Assign Field Executive</label>
                                                    <div className="flex gap-2">
                                                        {(() => {
                                                            // The routed partner's executives; for an unrouted order, those covering its pincode
                                                            // (or everyone in scope). Choosing another partner's executive moves the order to them.
                                                            const availableRiders = riders.filter(r => {
                                                                if (order.partnerId) return r.partnerId === order.partnerId;
                                                                if (!order.pincode) return true;
                                                                // @ts-ignore
                                                                if (r.partner && r.partner.pincodes && r.partner.pincodes.length > 0) {
                                                                    // @ts-ignore
                                                                    return r.partner.pincodes.includes(order.pincode);
                                                                }
                                                                return true;
                                                            }).sort((a, b) => a.status === 'available' ? -1 : 1);

                                                            return (
                                                                <select
                                                                    className="flex-1 p-2 border rounded-lg bg-background text-sm"
                                                                    value={order.riderId || ""}
                                                                    onChange={(e) => handleAssign(order.id, e.target.value)}
                                                                    disabled={assigningId === order.id}
                                                                >
                                                                    <option value="">{availableRiders.length ? 'Select Field Executive...' : 'No executives for this partner'}</option>
                                                                    {availableRiders.map(r => (
                                                                        <option key={r.id} value={r.id}>
                                                                            {r.name} ({r.status.toUpperCase()})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            );
                                                        })()}
                                                        {assigningId === order.id && (
                                                            <div className="flex items-center justify-center p-2">
                                                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {order.status === ORDER_STATUS.PICKED_UP && (
                                                <p className="text-xs text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30 p-2 rounded-lg">
                                                    Device collected — the executive is taking it to the hub.
                                                </p>
                                            )}

                                            {permissions.manage && (
                                                <button
                                                    onClick={() => handleFailOrder(order)}
                                                    className="w-full py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    Fail Order
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Payout: recorded once the device is collected (cash, UPI, bank transfer or gift card). */}
                                    {(order.status === ORDER_STATUS.PICKED_UP || order.status === ORDER_STATUS.COMPLETED) && (() => {
                                        const payout = payoutOf(order);
                                        return (
                                            <div className={`p-3 rounded-xl border text-sm space-y-2 ${payout.paid ? 'bg-green-50/60 border-green-200 dark:bg-green-950/20 dark:border-green-900/40' : 'bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40'}`}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Customer Payout</span>
                                                    <span className="font-bold">₹{payout.amount.toLocaleString()} · {payout.methodLabel}</span>
                                                </div>
                                                {payout.paid ? (
                                                    <p className="text-xs text-green-800 dark:text-green-300">
                                                        Paid{payout.paidAt ? ` on ${new Date(payout.paidAt).toLocaleDateString()}` : ''}{payout.paidBy ? ` by ${payout.paidBy}` : ''}{payout.reference ? ` · Ref ${payout.reference}` : ''}
                                                    </p>
                                                ) : permissions.manage ? (
                                                    <button
                                                        onClick={() => handleMarkPaid(order)}
                                                        className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors"
                                                    >
                                                        Mark Payout Paid
                                                    </button>
                                                ) : (
                                                    <p className="text-xs text-amber-800 dark:text-amber-300">Not paid yet.</p>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Action Column for Completed Orders: Hub Handover & Delete */}
                                    {order.status === 'completed' && (() => {
                                        const isHandedOver = answers.hubStatus === 'handed_over';
                                        return (
                                            <div className="bg-muted/40 p-4 rounded-xl border border-border/50 space-y-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hub Handover</span>
                                                    {isHandedOver ? (
                                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Handed Over to Hub
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1">
                                                            <Clock className="w-3.5 h-3.5 text-amber-600" /> Handover Pending
                                                        </span>
                                                    )}
                                                </div>

                                                {isHandedOver ? (
                                                    <div className="space-y-2">
                                                        <p className="text-xs text-muted-foreground">
                                                            Device safely received at hub
                                                            {answers.hubHandoverAt ? ` on ${new Date(answers.hubHandoverAt).toLocaleDateString()} at ${new Date(answers.hubHandoverAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                                                            {answers.hubReceivedBy ? ` (${answers.hubReceivedBy})` : ''}.
                                                        </p>
                                                        {permissions.manage && (<button
                                                            onClick={() => handleUpdateHubStatus(order.id, 'pending')}
                                                            className="w-full py-1.5 px-3 border border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg text-xs font-medium transition-colors"
                                                        >
                                                            Revert to Handover Pending
                                                        </button>)}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <p className="text-xs text-amber-900/80 dark:text-amber-300/80 font-medium">
                                                            Device is with {assignedRider ? assignedRider.name : 'delivery executive'}. Pending handover to the central hub.
                                                        </p>
                                                        {permissions.manage && (<button
                                                            onClick={() => handleUpdateHubStatus(order.id, 'handed_over')}
                                                            className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <Building2 className="w-4 h-4" /> Mark Handed Over to Hub
                                                        </button>)}
                                                    </div>
                                                )}

                                                {permissions.delete && (<button
                                                    onClick={() => handleDeleteOrder(order.id)}
                                                    className="w-full mt-2 py-2 border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" /> Delete Order
                                                </button>)}
                                            </div>
                                        );
                                    })()}

                                    {/* Action Column for Failed Orders: Restore & Delete */}
                                    {order.status === 'failed' && (
                                        <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 p-4 rounded-xl space-y-3">
                                            <div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 block mb-1">Failure Reason</span>
                                                <p className="text-xs text-red-900 dark:text-red-300 font-medium">
                                                    {answers.failLog && answers.failLog.length > 0
                                                        ? answers.failLog[answers.failLog.length - 1].reason
                                                        : "Marked as failed"}
                                                </p>
                                            </div>

                                            {permissions.manage && (<button
                                                onClick={() => handleRestoreOrder(order.id)}
                                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                <RotateCcw className="w-4 h-4" /> Restore Order
                                            </button>)}

                                            {permissions.delete && (<button
                                                onClick={() => handleDeleteOrder(order.id)}
                                                className="w-full py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
                                            </button>)}
                                        </div>
                                    )}

                                    {isRider && order.status === 'assigned' && (
                                        <button
                                            onClick={() => router.push('/pickup/dashboard')}
                                            className="w-full py-3 bg-emerald-500 text-white font-black rounded-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 uppercase tracking-widest text-xs"
                                        >
                                            <Camera className="w-5 h-5 mx-1" />
                                            Start Evaluation
                                        </button>
                                    )}

                                    {assignedRider && (
                                        <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm flex items-center gap-3">
                                            <div className="bg-white p-1 rounded-full shrink-0">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold">{assignedRider.name}</p>
                                                <a href={telHref(assignedRider.phone)} className="text-xs hover:underline">{displayPhone(assignedRider.phone)}</a>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 mt-1 rounded-full inline-block uppercase ${assignedRider.status === 'available' ? 'bg-green-100 text-green-700' :
                                                    assignedRider.status === 'busy' ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-700'}`}>
                                                    {assignedRider.status}
                                                </span>
                                            </div>
                                            <CheckCircle2 className="w-5 h-5 ml-auto opacity-50 shrink-0" />
                                        </div>
                                    )}

                                    {order.status === ORDER_STATUS.PRICE_REVIEW && (
                                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3 rounded-lg mt-3 w-full text-sm">
                                            <h4 className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-2">
                                                <AlertTriangle className="w-4 h-4" /> Revised Price — Approval Needed Before Pickup
                                            </h4>

                                            <div className="space-y-3 mt-2">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Executive Notes</p>
                                                    <p className="font-medium text-amber-900 dark:text-amber-200 mt-0.5 text-xs">
                                                        {order.riderAnswers
                                                            ? (parseAnswers(order.riderAnswers).notes || "No notes provided")
                                                            : "None"}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Device Photos</p>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {(order.verificationImages || []).map((img: string, i: number) => (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <a href={img} target="_blank" rel="noopener noreferrer" key={i}>
                                                                <img src={img} alt="Device Photo" className="w-12 h-12 object-cover rounded-md border shadow-sm hover:scale-105 transition-transform" />
                                                            </a>
                                                        ))}
                                                        {(!order.verificationImages || order.verificationImages.length === 0) && (
                                                            <p className="text-xs italic text-muted-foreground">No photos uploaded.</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between bg-white/60 dark:bg-black/20 p-2 rounded-lg border border-amber-200 dark:border-amber-900/40 text-xs">
                                                    <span className="font-medium text-muted-foreground">Quoted: <span className="line-through">₹{(priceReviewOf(order)?.quotedPrice ?? order.price).toLocaleString()}</span></span>
                                                    <span className="font-bold text-amber-900 dark:text-amber-200 text-sm">Offered: ₹{(priceReviewOf(order)?.requestedPrice ?? order.offeredPrice)?.toLocaleString() ?? "N/A"}</span>
                                                </div>

                                                {permissions.approvePrice ? (
                                                    <div className="flex gap-2 pt-1">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDecidePrice(order, false); }}
                                                            className="px-3 py-1.5 border border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-md font-semibold w-1/3 text-xs"
                                                        >
                                                            Reject
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDecidePrice(order, true); }}
                                                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white shadow-sm rounded-md font-bold w-2/3 text-xs"
                                                        >
                                                            Approve
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground">Waiting for the partner, RM, zonal head or an admin to decide.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}



                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {viewingOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-background rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-background/95 backdrop-blur z-20">
                            <h3 className="font-bold text-lg">Evaluation Details (FZK-{viewingOrder.orderNumber})</h3>
                            <button onClick={() => setViewingOrder(null)} className="p-2 hover:bg-muted rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="sticky top-[64px] bg-background border-b z-10 w-full px-6 pt-2 pb-1">
                            <OrderStepper order={{ ...viewingOrder, executive: riders.find(r => r.id === viewingOrder.riderId) ?? null }} />
                        </div>
                        <div className="p-6">
                            <OrderDetails order={viewingOrder} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
