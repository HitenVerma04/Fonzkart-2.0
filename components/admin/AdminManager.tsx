'use client';

import { useEffect, useState } from 'react';
import { addAdmin, addZonalHead, addRelationshipManager, addPartner, addFieldExecutive, removeAdmin, removeUserRole, deleteRider } from '@/actions/admin';
import { Trash2, Plus, Loader2, ShieldCheck, Mail, Briefcase, Building2, Users, Crown, Phone, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminManager({
    superAdmins,
    admins,
    zonalHeads,
    relationshipManagers,
    partners,
    riders
}: {
    superAdmins: any[],
    admins: any[],
    zonalHeads: any[],
    relationshipManagers: any[],
    partners: any[],
    riders: any[]
}) {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    // Removing a role can be undone for a short while (as in the Admin app): Undo gives the same role back. Removing
    // a role changes only the role, so a partner keeps its city, pincodes and managers.
    const [removed, setRemoved] = useState<{ email: string; roleName: string; restore: () => Promise<{ success?: boolean; error?: string }> } | null>(null);
    useEffect(() => {
        if (!removed) return;
        const timer = setTimeout(() => setRemoved(null), 15000);
        return () => clearTimeout(timer);
    }, [removed]);
    const [activeTab, setActiveTab] = useState<'superAdmins' | 'admins' | 'zonalHeads' | 'relationshipManagers' | 'partners' | 'riders'>('superAdmins');

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsLoading(true);
        try {
            const result = await addAdmin(email);
            if (result.success) { 
                alert(`Successfully granted Admin role to ${email}`);
                setEmail(''); 
                router.refresh(); 
            } else { 
                alert(result.error || 'Failed to add admin'); 
            }
        } catch { alert('Failed to add admin'); } finally { setIsLoading(false); }
    };

    const handleAddZonalHead = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setIsLoading(true);
        try {
            const result = await addZonalHead(email);
            if (result.success) { 
                alert(`Successfully granted Zonal Head role to ${email}`);
                setEmail(''); 
                router.refresh(); 
            } else { 
                alert(result.error || 'Failed'); 
            }
        } catch { alert('Failed'); } finally { setIsLoading(false); }
    };

    const handleAddRelationshipManager = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setIsLoading(true);
        try {
            const result = await addRelationshipManager(email);
            if (result.success) { 
                alert(`Successfully granted RM role to ${email}`);
                setEmail(''); 
                router.refresh(); 
            } else { 
                alert(result.error || 'Failed'); 
            }
        } catch { alert('Failed'); } finally { setIsLoading(false); }
    };

    const handleAddPartner = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setIsLoading(true);
        try {
            const result = await addPartner(email);
            if (result.success) { 
                alert(`Successfully granted Partner role to ${email}`);
                setEmail(''); 
                router.refresh(); 
            } else { 
                alert(result.error || 'Failed'); 
            }
        } catch { alert('Failed'); } finally { setIsLoading(false); }
    };

    const handleAddFieldExecutive = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setIsLoading(true);
        try {
            const result = await addFieldExecutive(email);
            if (result.success) { 
                alert(`Successfully granted Field Executive role to ${email}`);
                setEmail(''); 
                router.refresh(); 
            } else { 
                alert(result.error || 'Failed'); 
            }
        } catch { alert('Failed'); } finally { setIsLoading(false); }
    };

    const handleRemoveAdmin = async (adminEmail: string) => {
        try {
            const result = await removeAdmin(adminEmail);
            if (result.success) {
                setRemoved({ email: adminEmail, roleName: 'Admin', restore: () => addAdmin(adminEmail) });
                router.refresh();
            } else {
                alert(result.error || 'Failed to remove admin');
            }
        } catch {
            alert('Failed to remove admin');
        }
    };

    /** `restore` gives the role back (Undo); without one (super admins) the removal is confirmed first instead. */
    const handleRemoveRole = async (email: string, roleName: string, restore?: () => Promise<{ success?: boolean; error?: string }>) => {
        if (!restore && !confirm(`Remove ${roleName} privileges from ${email}?`)) return;
        try {
            const result = await removeUserRole(email);
            if (result.success) {
                if (restore) setRemoved({ email, roleName, restore });
                router.refresh();
            } else {
                alert(result.error || `Failed to remove ${roleName}`);
            }
        } catch {
            alert(`Failed to remove ${roleName}`);
        }
    };

    const undo = async () => {
        const r = removed;
        if (!r) return;
        setRemoved(null);
        try {
            const result = await r.restore();
            if (result.success === false || result.error) alert(result.error || `Could not give the ${r.roleName} role back.`);
            router.refresh();
        } catch {
            alert(`Could not give the ${r.roleName} role back.`);
        }
    };

    const handleDeleteRider = async (id: string) => {
        if (!confirm(`Remove field executive?`)) return;
        try {
            const result = await deleteRider(id);
            if (result.success) {
                router.refresh();
            } else {
                alert('Failed to remove field executive');
            }
        } catch {
            alert('Failed to remove field executive');
        }
    };

    const tabs = [
        { id: 'superAdmins', label: 'Super Admins', icon: Crown, count: superAdmins.length },
        { id: 'admins', label: 'Admins', icon: ShieldCheck, count: admins.length },
        { id: 'zonalHeads', label: 'Zonal Heads', icon: Briefcase, count: zonalHeads.length },
        { id: 'relationshipManagers', label: 'RMs', icon: UserCheck, count: relationshipManagers.length },
        { id: 'partners', label: 'Partners', icon: Building2, count: partners.length },
        { id: 'riders', label: 'Field Executives', icon: Users, count: riders.length },
    ] as const;

    return (
        <div className="space-y-6">
            {removed ? (
                <div role="status" className="flex items-center justify-between gap-4 rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white dark:bg-zinc-800">
                    <span>{removed.email} is no longer {removed.roleName === 'Admin' ? 'an' : 'a'} {removed.roleName.toLowerCase()} (now a customer account).</span>
                    <button type="button" onClick={undo} className="shrink-0 font-black tracking-wide text-green-400 hover:text-green-300">UNDO</button>
                </div>
            ) : null}
            <div className="flex overflow-x-auto border-b border-border/50 pb-px gap-6 hide-scrollbar">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`pb-3 flex items-center gap-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] bg-secondary text-secondary-foreground`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            <div className="pt-4 pb-12">
                {activeTab === 'superAdmins' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {superAdmins.map((admin) => (
                                <div key={admin.id} className="p-4 border border-primary/20 rounded-xl bg-primary/5 flex flex-col sm:flex-row items-start sm:items-center justify-between group shadow-sm gap-4">
                                    <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
                                        <div className="p-3 bg-primary/20 text-primary rounded-xl shrink-0">
                                            <Crown className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0 mt-0.5 flex-1">
                                            <p className="font-bold truncate text-foreground">{admin.name}</p>
                                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1 truncate">
                                                <Mail className="w-3 h-3 shrink-0" />
                                                <span className="truncate">{admin.email}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto justify-end sm:justify-start">
                                        <button
                                            onClick={() => handleRemoveRole(admin.email, 'Super Admin')}
                                            className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors focus:opacity-100 shrink-0"
                                            title="Revoke Super Admin Access"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {superAdmins.length === 0 && <p className="text-muted-foreground text-sm col-span-1 md:col-span-2 lg:col-span-3 p-4 bg-muted/20 border-dashed border rounded-xl text-center">No Super Admins found.</p>}
                        </div>
                    </div>
                )}

                {activeTab === 'admins' && (
                    <div className="space-y-8">
                        <div className="bg-card border rounded-xl p-6 shadow-sm">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-primary" />
                                Grant User Admin Privilege
                            </h3>
                            <form onSubmit={handleAddAdmin} className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1 space-y-2 w-full">
                                    <label className="text-sm font-medium text-muted-foreground">User Email Address</label>
                                    <input
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        type="email"
                                        className="w-full h-10 px-3 border rounded-lg bg-background outline-none focus:border-primary transition-colors"
                                        placeholder="user@example.com"
                                    />
                                </div>
                                <button
                                    disabled={isLoading || !email}
                                    className="px-4 h-10 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 min-w-[120px] flex justify-center items-center text-sm font-medium transition-colors"
                                >
                                    {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <div className="flex items-center gap-2"><Plus className="w-4 h-4" /> Grant Admin</div>}
                                </button>
                            </form>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {admins.map((admin) => (
                                <div key={admin.id} className="p-4 border rounded-xl bg-card shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between group gap-4">
                                    <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
                                        <div className="p-3 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-500 rounded-xl shrink-0">
                                            <ShieldCheck className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0 mt-0.5 flex-1">
                                            <p className="font-bold truncate text-foreground">{admin.name}</p>
                                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1 truncate">
                                                <Mail className="w-3 h-3 shrink-0" />
                                                <span className="truncate">{admin.email}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="self-end sm:self-auto w-full sm:w-auto flex justify-end sm:justify-start">
                                        <button
                                            onClick={() => handleRemoveAdmin(admin.email)}
                                            className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors focus:opacity-100 shrink-0"
                                            title="Revoke Admin Access"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {admins.length === 0 && <p className="text-muted-foreground text-sm col-span-1 md:col-span-2 lg:col-span-3 p-4 bg-muted/20 border-dashed border rounded-xl text-center">No standard Admins found.</p>}
                        </div>
                    </div>
                )}
                {activeTab === 'zonalHeads' && (
                    <div className="space-y-8">
                        <div className="bg-card border rounded-xl p-6 shadow-sm">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Briefcase className="w-5 h-5 text-blue-500" />
                                Grant Zonal Head Privilege
                            </h3>
                            <form onSubmit={handleAddZonalHead} className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1 space-y-2 w-full">
                                    <label className="text-sm font-medium text-muted-foreground">User Email Address</label>
                                    <input
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        type="email"
                                        className="w-full h-10 px-3 border rounded-lg bg-background outline-none focus:border-primary transition-colors"
                                        placeholder="user@example.com"
                                    />
                                </div>
                                <button
                                    disabled={isLoading || !email}
                                    className="px-4 h-10 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 min-w-[120px] flex justify-center items-center text-sm font-medium transition-colors"
                                >
                                    {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <div className="flex items-center gap-2"><Plus className="w-4 h-4" /> Grant Role</div>}
                                </button>
                            </form>
                        </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {zonalHeads.map((zh) => (
                            <div key={zh.id} className="p-4 border rounded-xl bg-card shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between group gap-4">
                                <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
                                    <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500 rounded-xl shrink-0">
                                        <Briefcase className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 mt-0.5 flex-1">
                                        <p className="font-bold truncate text-foreground">{zh.name}</p>
                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1 truncate">
                                            <Mail className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{zh.email}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="self-end sm:self-auto w-full sm:w-auto flex justify-end sm:justify-start">
                                    <button
                                        onClick={() => handleRemoveRole(zh.email, 'Zonal Head', () => addZonalHead(zh.email))}
                                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors focus:opacity-100 shrink-0"
                                        title="Revoke Zonal Head Access"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {zonalHeads.length === 0 && <p className="text-muted-foreground text-sm col-span-1 md:col-span-2 lg:col-span-3 p-4 bg-muted/20 border-dashed border rounded-xl text-center">No Zonal Heads found.</p>}
                    </div>
                </div>
                )}

                {activeTab === 'relationshipManagers' && (
                    <div className="space-y-8">
                        <div className="bg-card border rounded-xl p-6 shadow-sm">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <UserCheck className="w-5 h-5 text-indigo-500" />
                                Grant Relationship Manager Privilege
                            </h3>
                            <form onSubmit={handleAddRelationshipManager} className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1 space-y-2 w-full">
                                    <label className="text-sm font-medium text-muted-foreground">User Email Address</label>
                                    <input
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        type="email"
                                        className="w-full h-10 px-3 border rounded-lg bg-background outline-none focus:border-primary transition-colors"
                                        placeholder="user@example.com"
                                    />
                                </div>
                                <button
                                    disabled={isLoading || !email}
                                    className="px-4 h-10 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 min-w-[120px] flex justify-center items-center text-sm font-medium transition-colors"
                                >
                                    {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <div className="flex items-center gap-2"><Plus className="w-4 h-4" /> Grant Role</div>}
                                </button>
                            </form>
                        </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {relationshipManagers.map((rm) => (
                            <div key={rm.id} className="p-4 border rounded-xl bg-card shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between group gap-4">
                                <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-500 rounded-xl shrink-0">
                                        <UserCheck className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 mt-0.5 flex-1">
                                        <p className="font-bold truncate text-foreground">{rm.name}</p>
                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1 truncate">
                                            <Mail className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{rm.email}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="self-end sm:self-auto w-full sm:w-auto flex justify-end sm:justify-start">
                                    <button
                                        onClick={() => handleRemoveRole(rm.email, 'Relationship Manager', () => addRelationshipManager(rm.email))}
                                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors focus:opacity-100 shrink-0"
                                        title="Revoke RM Access"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {relationshipManagers.length === 0 && <p className="text-muted-foreground text-sm col-span-1 md:col-span-2 lg:col-span-3 p-4 bg-muted/20 border-dashed border rounded-xl text-center">No Relationship Managers found.</p>}
                    </div>
                </div>
                )}

                {activeTab === 'partners' && (
                    <div className="space-y-8">
                        <div className="bg-card border rounded-xl p-6 shadow-sm">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-purple-500" />
                                Grant Partner Privilege
                            </h3>
                            <form onSubmit={handleAddPartner} className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1 space-y-2 w-full">
                                    <label className="text-sm font-medium text-muted-foreground">User Email Address</label>
                                    <input
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        type="email"
                                        className="w-full h-10 px-3 border rounded-lg bg-background outline-none focus:border-primary transition-colors"
                                        placeholder="user@example.com"
                                    />
                                </div>
                                <button
                                    disabled={isLoading || !email}
                                    className="px-4 h-10 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 min-w-[120px] flex justify-center items-center text-sm font-medium transition-colors"
                                >
                                    {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <div className="flex items-center gap-2"><Plus className="w-4 h-4" /> Grant Role</div>}
                                </button>
                            </form>
                        </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {partners.map((partner) => (
                            <div key={partner.id} className="p-4 border rounded-xl bg-card shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between group gap-4">
                                <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
                                    <div className="p-3 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-500 rounded-xl shrink-0">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 mt-0.5 flex-1">
                                        <p className="font-bold truncate text-foreground">{partner.name}</p>
                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1 truncate">
                                            <Mail className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{partner.email}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="self-end sm:self-auto w-full sm:w-auto flex justify-end sm:justify-start">
                                    <button
                                        onClick={() => handleRemoveRole(partner.email, 'Partner', () => addPartner(partner.email, partner.cityId ?? undefined, partner.managerId ?? undefined))}
                                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors focus:opacity-100 shrink-0"
                                        title="Revoke Partner Access"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {partners.length === 0 && <p className="text-muted-foreground text-sm col-span-1 md:col-span-2 lg:col-span-3 p-4 bg-muted/20 border-dashed border rounded-xl text-center">No Partners found.</p>}
                    </div>
                </div>
                )}

                {activeTab === 'riders' && (
                    <div className="space-y-8">
                         <div className="bg-card border rounded-xl p-6 shadow-sm">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Users className="w-5 h-5 text-orange-500" />
                                Grant Field Executive Login Privilege
                            </h3>
                            <form onSubmit={handleAddFieldExecutive} className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1 space-y-2 w-full">
                                    <label className="text-sm font-medium text-muted-foreground">User Email Address</label>
                                    <input
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        type="email"
                                        className="w-full h-10 px-3 border rounded-lg bg-background outline-none focus:border-primary transition-colors"
                                        placeholder="user@example.com"
                                    />
                                </div>
                                <button
                                    disabled={isLoading || !email}
                                    className="px-4 h-10 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 min-w-[120px] flex justify-center items-center text-sm font-medium transition-colors"
                                >
                                    {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <div className="flex items-center gap-2"><Plus className="w-4 h-4" /> Grant Role</div>}
                                </button>
                            </form>
                        </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {riders.map((rider) => (
                            <div key={rider.id} className="p-4 border rounded-xl bg-card shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between group gap-4">
                                <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
                                    <div className="p-3 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 rounded-xl shrink-0">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 mt-0.5 flex-1">
                                        <p className="font-bold truncate text-foreground">{rider.name}</p>
                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1 truncate">
                                            <Phone className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{rider.phone}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-2 self-stretch sm:self-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-border/50">
                                    <span className={`text-[10px] tracking-wider font-bold px-2.5 py-1 rounded-full shrink-0 ${rider.status === 'available' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-500' :
                                        rider.status === 'busy' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-500' : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white'
                                        }`}>
                                        {rider.status.toUpperCase()}
                                    </span>
                                    <button
                                        onClick={() => handleDeleteRider(rider.id)}
                                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors focus:opacity-100 shrink-0"
                                        title="Remove Field Executive"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {riders.length === 0 && <p className="text-muted-foreground text-sm col-span-1 md:col-span-2 lg:col-span-3 p-4 bg-muted/20 border-dashed border rounded-xl text-center">No Field Executives found.</p>}
                    </div>
                </div>
                )}
            </div>
        </div>
    );
}
