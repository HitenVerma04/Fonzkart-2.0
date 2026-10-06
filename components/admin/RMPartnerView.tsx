'use client';

import { useState } from 'react';
import { Building2, Package, Clock, Users, ChevronRight, ChevronDown, CheckCircle2, User, Phone, MapPin, AlertCircle } from 'lucide-react';

export default function RMPartnerView({ partners }: { partners: any[] }) {
    const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null);

    const togglePartner = (id: string) => {
        setExpandedPartnerId(expandedPartnerId === id ? null : id);
    };

    if (partners.length === 0) {
        return (
            <div className="bg-card border border-dashed rounded-xl p-12 text-center text-muted-foreground">
                <p>No partners are assigned to you yet. An admin can assign partners to you on the Partners page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {partners.map(partner => {
                const isExpanded = expandedPartnerId === partner.id;
                const totalOrders = partner.orders.length;
                const unassignedCount = partner.unassignedOrders.length;
                const delayedCount = partner.delayedOrders.length;
                const activeRidersCount = partner.riders.filter((r: any) => r.status === 'available').length;

                return (
                    <div key={partner.id} className="bg-card border rounded-xl overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md">
                        <div 
                            className={`p-4 sm:p-6 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${isExpanded ? 'bg-muted/30 border-b' : ''}`}
                            onClick={() => togglePartner(partner.id)}
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-xl shrink-0">
                                    <Building2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        {partner.name}
                                        {delayedCount > 0 && (
                                            <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                                                <AlertCircle className="w-3 h-3" />
                                                {delayedCount} Delayed
                                            </span>
                                        )}
                                    </h3>
                                    <div className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {partner.city?.name || 'No City'}</span>
                                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {partner.phone}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="flex gap-4">
                                    <div className="text-center">
                                        <p className="text-2xl font-black text-foreground">{totalOrders}</p>
                                        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Total Orders</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-black text-orange-500">{unassignedCount}</p>
                                        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Unassigned</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-black text-blue-500">{partner.riders.length}</p>
                                        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Executives</p>
                                    </div>
                                </div>
                                <div className="text-muted-foreground">
                                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                </div>
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="p-4 sm:p-6 bg-muted/10 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Orders Section */}
                                <div className="space-y-4">
                                    <h4 className="font-bold flex items-center gap-2 text-foreground">
                                        <Package className="w-4 h-4 text-primary" />
                                        Recent Orders
                                    </h4>
                                    <div className="space-y-3">
                                        {partner.orders.length === 0 ? (
                                            <p className="text-sm text-muted-foreground italic bg-background p-3 rounded-lg border">No orders found for this partner's pincodes.</p>
                                        ) : (
                                            partner.orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10).map((order: any) => {
                                                const assignedRider = partner.riders.find((r: any) => r.id === order.riderId);
                                                const diffMinutes = Math.floor((new Date().getTime() - new Date(order.createdAt).getTime()) / 60000);
                                                const isDelayed = !order.riderId && diffMinutes >= 5;

                                                return (
                                                    <div key={order.id} className={`p-3 rounded-lg border flex flex-col gap-2 ${isDelayed ? 'bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50' : 'bg-background'}`}>
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <p className="font-semibold text-sm">#{order.orderNumber} - {order.device}</p>
                                                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                    <MapPin className="w-3 h-3" /> {order.pincode || 'No Pincode'}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                                    order.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                                    order.status === 'Cancelled' ? 'bg-gray-100 text-gray-700' :
                                                                    'bg-blue-100 text-blue-700'
                                                                }`}>
                                                                    {order.status}
                                                                </span>
                                                                <p className="text-[10px] text-muted-foreground mt-1 flex items-center justify-end gap-1">
                                                                    <Clock className="w-3 h-3" /> {diffMinutes}m ago
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="pt-2 border-t flex justify-between items-center mt-1">
                                                            {order.riderId ? (
                                                                <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 font-medium">
                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                    Assigned to: {assignedRider?.name || 'Unknown Executive'}
                                                                </div>
                                                            ) : (
                                                                <div className={`flex items-center gap-1.5 text-sm font-medium ${isDelayed ? 'text-red-600 dark:text-red-400' : 'text-orange-500'}`}>
                                                                    {isDelayed ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                                                    Unassigned
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                        {partner.orders.length > 10 && (
                                            <p className="text-xs text-center text-muted-foreground pt-2">Showing 10 most recent orders.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Field Executives Section */}
                                <div className="space-y-4">
                                    <h4 className="font-bold flex items-center gap-2 text-foreground">
                                        <Users className="w-4 h-4 text-blue-500" />
                                        Field Executives
                                    </h4>
                                    <div className="space-y-3">
                                        {partner.riders.length === 0 ? (
                                            <p className="text-sm text-muted-foreground italic bg-background p-3 rounded-lg border">No executives assigned to this partner.</p>
                                        ) : (
                                            partner.riders.map((rider: any) => (
                                                <div key={rider.id} className="p-3 rounded-lg border bg-background flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 text-secondary-foreground">
                                                            <User className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-sm">{rider.name}</p>
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                <Phone className="w-3 h-3" /> {rider.phone}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                        rider.status === 'available' ? 'bg-green-100 text-green-700' :
                                                        rider.status === 'busy' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-gray-100 text-gray-700'
                                                    }`}>
                                                        {rider.status}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
