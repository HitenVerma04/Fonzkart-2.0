
"use client";
import { useState, useEffect } from 'react';
import { fetchRoleBasedEmails, fetchEmailById, syncImapEmails, deleteEmailAccountAction } from '@/actions/email-hub';
import { 
    Mail, 
    Send, 
    Settings, 
    Search, 
    RefreshCw, 
    ChevronLeft, 
    User, 
    Plus,
    X,
    CheckCircle2,
    Loader2,
    Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EmailClient({ role: initialRole, userEmail: initialUserEmail }: { role: string, userEmail: string }) {
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'compose' | 'manage'>('inbox');
  const [emails, setEmails] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [fullEmail, setFullEmail] = useState<any | null>(null);
  
  // Diagnostic State
  const [debugData, setDebugData] = useState({
      role: initialRole,
      dbCount: 0,
      accountCount: 0,
      error: null as string | null
  });

  // Filtering
  const [reachableEmails, setReachableEmails] = useState<string[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Compose State
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Manage Accounts State
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const isScopeVisible = ['SUPER_ADMIN', 'ADMIN', 'ZONAL_HEAD', 'PARTNER'].includes(initialRole);
  const isIdentityHubVisible = ['SUPER_ADMIN', 'ADMIN'].includes(initialRole);

  useEffect(() => {
    loadEmails(true); 
  }, [selectedAccount, initialRole]);

  const loadEmails = async (skipSync: boolean = false) => {
    setIsLoading(true);
    try {
      const result: any = await fetchRoleBasedEmails(selectedAccount || undefined, skipSync);
      if (result.error) {
          setDebugData(prev => ({ ...prev, error: result.error }));
      } else {
          setEmails(result.emails);
          if (result.reachableEmails) setReachableEmails(result.reachableEmails);
          setDebugData(prev => ({ 
              ...prev, 
              dbCount: result.totalInDb, 
              accountCount: result.totalAccounts,
              role: result.userRole,
              error: null
          }));
      }
    } catch (e: any) {
      console.error(e);
      setDebugData(prev => ({ ...prev, error: e.message }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
        await syncImapEmails(selectedAccount || undefined);
        await loadEmails(true); 
    } catch (e: any) {
        alert('Sync failed: ' + e.message);
    } finally {
        setIsSyncing(false);
    }
  }

  const viewEmailDetail = async (id: string) => {
    setSelectedEmailId(id);
    const email = emails.find(e => e.id === id);
    if (email) {
        setFullEmail(email);
        try {
            const detailed = await fetchEmailById(id);
            if (detailed) setFullEmail(detailed);
        } catch (e) {}
    }
  };

  return (
    <div className="flex h-screen lg:h-[calc(100vh-64px)] bg-[#f8fafc] dark:bg-slate-950 overflow-hidden flex-col md:flex-row font-sans transition-colors duration-500">
      
      {/* SIDEBAR - Adaptive width for tablet/desktop */}
      <div className="w-full md:w-20 lg:w-64 bg-white dark:bg-black border-r border-slate-200 dark:border-white/10 flex flex-col shrink-0 transition-all duration-300">
        <div className="p-4 lg:p-6 flex items-center justify-between md:justify-center lg:justify-start">
            <div className="flex items-center gap-3">
                <Mail className="w-6 h-6 text-emerald-600 shrink-0" />
                <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent hidden lg:block truncate">
                    FonzMail
                </h1>
            </div>
            <div className="md:hidden flex items-center gap-2">
                <button onClick={handleManualSync} className="p-2 text-slate-400 hover:text-emerald-600">
                    <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
            </div>
        </div>

        <div className="px-3 lg:px-4 mb-4 lg:mb-6 hidden md:block">
            <button 
                onClick={() => { setActiveTab('compose'); setSelectedEmailId(null); }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl lg:rounded-2xl py-3 px-2 lg:px-4 flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-none transition-all font-semibold"
            >
                <Plus className="w-5 h-5 shrink-0" />
                <span className="hidden lg:inline">Compose</span>
            </button>
        </div>

        {/* Navigation - Adaptive Labels */}
        <nav className="hidden md:flex flex-1 flex-col px-2 space-y-1">
            {[ 
                { id: 'inbox', label: 'Inbox', icon: Mail },
                { id: 'sent', label: 'Sent', icon: Send },
                { id: 'manage', label: 'Identity Hub', icon: Settings, authReq: isIdentityHubVisible }
            ].map((item) => {
                if (item.authReq === false) return null;
                const Icon = item.icon;
                return (
                    <button
                        key={item.id}
                        onClick={() => { setActiveTab(item.id as any); setSelectedEmailId(null); }}
                        className={`w-full flex items-center justify-center lg:justify-start px-3 lg:px-4 py-3.5 rounded-xl transition-all ${
                            activeTab === item.id ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                        title={item.label}
                    >
                        <div className="flex items-center gap-3">
                            <Icon className={`w-5 h-5 shrink-0 ${activeTab === item.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                            <span className="font-semibold text-sm hidden lg:inline tracking-tight">{item.label}</span>
                        </div>
                    </button>
                );
            })}
        </nav>

        {/* Mobile Nav Bar - Only on small screens */}
        <div className="md:hidden flex items-center justify-around border-t border-slate-100 dark:border-white/10 p-2 bg-white dark:bg-black sticky bottom-0 z-50">
             <button onClick={() => { setActiveTab('inbox'); setSelectedEmailId(null); }} className={`p-3 ${activeTab === 'inbox' ? 'text-emerald-600' : 'text-slate-400'}`}><Mail className="w-6 h-6" /></button>
             <button onClick={() => { setActiveTab('sent'); setSelectedEmailId(null); }} className={`p-3 ${activeTab === 'sent' ? 'text-emerald-600' : 'text-slate-400'}`}><Send className="w-6 h-6" /></button>
             <button onClick={() => { setActiveTab('compose'); setSelectedEmailId(null); }} className="p-3 bg-emerald-600 text-white rounded-full shadow-lg -mt-8 border-4 border-white dark:border-slate-950"><Plus className="w-6 h-6" /></button>
             {isIdentityHubVisible && <button onClick={() => { setActiveTab('manage'); setSelectedEmailId(null); }} className={`p-3 ${activeTab === 'manage' ? 'text-emerald-600' : 'text-slate-400'}`}><Settings className="w-6 h-6" /></button>}
        </div>

        {/* Scoped Selector - Adaptive */}
        {isScopeVisible && (
            <div className="hidden md:block p-3 lg:p-4 border-t border-slate-100 dark:border-white/10">
                <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 mb-2 hidden lg:block px-1">Scope</label>
                <select 
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-2 text-[10px] lg:text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                >
                    <option value="" className="dark:bg-slate-900">All Nodes</option>
                    {reachableEmails.map(acc => (
                        <option key={acc} value={acc} className="dark:bg-slate-900">
                            {acc.split('@')[0]}
                        </option>
                    ))}
                </select>
            </div>
        )}

        {/* Diagnostic Panel - Adaptive */}
        <div className="hidden md:block p-3 lg:p-4">
            <div className="p-3 rounded-xl bg-slate-900 shadow-xl border border-white/5 space-y-1.5">
                <div className="flex justify-between items-center border-b border-white/10 pb-1 mb-1 hidden lg:flex">
                    <span className="text-[10px] text-slate-500 font-black uppercase">Engine</span>
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-500 hidden lg:inline">DB:</span>
                    <span className="text-emerald-400 font-bold ml-auto">{debugData.dbCount}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-500 hidden lg:inline">HIT:</span>
                    <span className="text-blue-400 font-bold ml-auto">{emails.length}</span>
                </div>
            </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-950 relative">
        <header className="h-16 border-b border-slate-100 dark:border-white/10 flex items-center justify-between px-4 lg:px-6 shrink-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-30">
            <div className="flex items-center gap-2 lg:gap-4 flex-1">
                {selectedEmailId ? (
                    <button onClick={() => setSelectedEmailId(null)} className="md:hidden p-2 -ml-2 text-slate-500"><ChevronLeft className="w-5 h-5" /></button>
                ) : (
                    isScopeVisible && (
                        <div className="md:hidden flex items-center bg-slate-100 dark:bg-white/5 rounded-xl px-2.5 py-1.5 border border-transparent focus-within:border-emerald-500/50 transition-all">
                            <User className="w-3.5 h-3.5 text-emerald-500 mr-2" />
                            <select 
                                value={selectedAccount}
                                onChange={(e) => setSelectedAccount(e.target.value)}
                                className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-tight text-slate-900 dark:text-white appearance-none pr-4 min-w-[70px]"
                                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2310b981\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'4\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '8px' }}
                            >
                                <option value="" className="dark:bg-slate-900">ALL NODES</option>
                                {reachableEmails.map(acc => (
                                    <option key={acc} value={acc} className="dark:bg-slate-900">
                                        {acc.split('@')[0].toUpperCase()}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )
                )}
                <div className="relative flex-1 max-w-lg">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Search fonzmail..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-100/50 dark:bg-white/5 border-none rounded-2xl py-2.5 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10 placeholder:text-slate-400 dark:text-white font-medium transition-all"
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-4 ml-4">
                <button onClick={handleManualSync} disabled={isSyncing} className="hidden md:flex p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-500 transition-all">
                    <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>

                {/* Mobile Diagnostic Status */}
                <div className="md:hidden flex items-center bg-slate-900 rounded-full px-2 py-0.5 border border-white/5 shadow-lg">
                    <div className="flex gap-2 text-[8px] font-mono font-bold leading-none">
                        <span className="text-emerald-400 flex items-center gap-0.5"><div className="w-1 h-1 bg-emerald-500 rounded-full"></div> {debugData.dbCount}</span>
                        <span className="text-blue-400">/ {emails.length}</span>
                    </div>
                </div>

                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-500/20 dark:to-teal-500/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold text-sm border border-emerald-200/50 dark:border-emerald-500/20">
                    {initialUserEmail.charAt(0).toUpperCase()}
                </div>
            </div>
        </header>

        <div className="flex-1 flex flex-row overflow-hidden relative">
            
            {/* EMAIL LIST - Responsive Width (Hides if Identity Hub or Full Compose is active) */}
            {(activeTab === 'inbox' || activeTab === 'sent') && (
            <div className={`transition-all duration-300 flex-1 overflow-y-auto bg-white dark:bg-slate-950 ${selectedEmailId ? 'max-w-0 md:max-w-xs lg:max-w-sm xl:max-w-md border-r border-slate-50 dark:border-white/5 hidden md:block' : 'w-full'}`}>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20"><Loader2 className="w-10 h-10 text-emerald-500 animate-spin" /></div>
                ) : emails.filter(e => activeTab === 'sent' ? e.isOutbound : !e.isOutbound).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-4"><Mail className="w-8 h-8 text-slate-200 dark:text-slate-700" /></div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-200">No emails here</h3>
                        <p className="text-slate-400 text-sm mt-1 max-w-[200px]">Everything is up to date.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100/50 dark:divide-white/5">
                        {emails.filter(e => activeTab === 'sent' ? e.isOutbound : !e.isOutbound).map((email, i) => (
                            <motion.div 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                key={email.id}
                                onClick={() => viewEmailDetail(email.id)}
                                className={`cursor-pointer px-4 lg:px-6 py-5 flex flex-col gap-1.5 transition-all ${selectedEmailId === email.id ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-l-4 border-emerald-500' : 'hover:bg-slate-50 dark:hover:bg-white/5 border-l-4 border-transparent'}`}
                            >
                                <div className="flex justify-between items-start text-[11px] lg:text-xs">
                                    <span className="font-bold text-slate-900 dark:text-slate-100 truncate pr-4">{email.isOutbound ? `To: ${email.toEmail}` : email.fromEmail}</span>
                                    <span className="text-slate-400 font-semibold whitespace-nowrap">{new Date(email.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                </div>
                                <h4 className={`text-xs font-bold truncate ${selectedEmailId === email.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>{email.subject}</h4>
                                <p className="text-[11px] text-slate-400 line-clamp-1 font-medium">{email.snippet || (email.text && email.text.substring(0, 80)) || 'No content'}</p>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
            )}

            {/* EMAIL DETAIL - Responsive Viewport */}
            <AnimatePresence>
                {(selectedEmailId && fullEmail) && (
                    <motion.div initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 30, opacity: 0 }}
                        className="flex-1 bg-white dark:bg-slate-950 flex flex-col z-40 absolute inset-0 md:relative overflow-hidden"
                    >
                        <div className="h-14 border-b border-slate-100 dark:border-white/10 flex items-center justify-between px-4 lg:px-6 shrink-0 bg-white dark:bg-slate-950">
                            <button onClick={() => setSelectedEmailId(null)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 rounded-full transition-all"><ChevronLeft className="w-5 h-5" /></button>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setSelectedEmailId(null)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-all"><X className="w-5 h-5" /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 lg:p-12 xl:p-16 max-w-5xl mx-auto w-full">
                            <h1 className="text-2xl lg:text-4xl font-black text-slate-900 dark:text-white mb-8 leading-[1.1] tracking-tight">{fullEmail.subject}</h1>
                            <div className="flex items-center gap-4 mb-10 pb-8 border-b border-slate-100 dark:border-white/5">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-600/5 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-xl border border-emerald-100 dark:border-emerald-500/20">{(fullEmail.fromEmail || '?').charAt(0).toUpperCase()}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-3">
                                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm lg:text-base">{fullEmail.fromEmail || fullEmail.from}</span>
                                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full w-fit border border-emerald-100/50 dark:border-emerald-500/20">Verified Sender</span>
                                    </div>
                                    <p className="text-[11px] lg:text-xs text-slate-400 mt-1 font-semibold truncate">To: {fullEmail.toEmail || fullEmail.to}</p>
                                </div>
                                <div className="hidden sm:block text-right shrink-0">
                                    <span className="text-[10px] text-slate-400 font-black uppercase mb-1 block">Sent on</span>
                                    <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">{new Date(fullEmail.receivedAt || fullEmail.date).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="text-slate-700 dark:text-slate-300 text-sm lg:text-lg leading-relaxed lg:leading-[1.8] font-medium break-words">
                                {/* Email HTML comes from anyone who can send mail: it is shown in a sandboxed frame (no scripts, no forms,
                                    not this site's origin), so it can never act as the signed-in admin. Links open in a new tab. */}
                                {fullEmail.bodyHtml ? <iframe title="Email content" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={`<base target="_blank">${fullEmail.bodyHtml}`} className="email-content-wrapper w-full h-[60vh] bg-white rounded-3xl border-0" /> :<p className="whitespace-pre-wrap">{fullEmail.bodyText || fullEmail.text}</p>}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* COMPOSE VIEW */}
            {!selectedEmailId && activeTab === 'compose' && (
                <div className="flex-1 flex flex-col items-center bg-[#f8fafc] dark:bg-slate-950 overflow-y-auto p-4 lg:p-12">
                    <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100/50 dark:border-white/5 transition-all flex flex-col h-fit">
                        <header className="px-6 lg:px-8 py-5 border-b border-slate-50 dark:border-white/5 flex items-center justify-between">
                            <h2 className="font-black text-slate-900 dark:text-white text-lg tracking-tight">New Message</h2>
                            <button onClick={() => setActiveTab('inbox')} className="text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 p-2"><X className="w-5 h-5" /></button>
                        </header>
                        <form onSubmit={handleSendEmail} className="p-6 lg:p-10 space-y-5 lg:space-y-8">
                            {isScopeVisible && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">From Account</label>
                                    <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="w-full p-3.5 lg:p-4 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/5 font-bold text-sm transition-all appearance-none cursor-pointer">
                                        <option value="" className="dark:bg-slate-900">Default (System)</option>
                                        {reachableEmails.map(email => <option key={email} value={email} className="dark:bg-slate-900">{email}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Recipient</label><input type="email" required value={composeTo} onChange={(e) => setComposeTo(e.target.value)} className="w-full p-3.5 lg:p-4 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/5 font-bold text-sm transition-all shadow-inner" placeholder="user@domain.com" /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Topic</label><input type="text" required value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} className="w-full p-3.5 lg:p-4 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/5 font-bold text-sm transition-all" placeholder="Subject line" /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Message</label><textarea required rows={8} value={composeBody} onChange={(e) => setComposeBody(e.target.value)} className="w-full p-3.5 lg:p-4 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/5 font-medium text-sm lg:text-base resize-none transition-all shadow-inner"></textarea></div>
                            <button type="submit" disabled={isSending} className="w-full bg-slate-900 dark:bg-emerald-600 hover:bg-black dark:hover:bg-emerald-500 text-white p-4.5 lg:p-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl active:scale-[0.98] transition-all group">
                                {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />} {isSending ? 'SENDING...' : 'DISPATCH EMAIL'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* IDENTITY HUB - Clean Full-Width Redesign */}
            {!selectedEmailId && activeTab === 'manage' && isIdentityHubVisible && (
                <div className="flex-1 overflow-y-auto p-6 lg:p-12 xl:p-20 bg-slate-50 dark:bg-slate-950">
                    <div className="max-w-7xl mx-auto space-y-12 lg:space-y-20 pb-24 lg:pb-10">
                        <header className="space-y-4">
                            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 mb-2">
                                <div className="p-2 bg-emerald-500/10 rounded-xl">
                                    <Settings className="w-6 h-6 lg:w-8 lg:h-8" />
                                </div>
                                <span className="text-xs font-black uppercase tracking-[0.3em]">Module Identity</span>
                            </div>
                            <h2 className="text-4xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">Identity Hub</h2>
                            <p className="text-slate-400 dark:text-slate-500 text-base lg:text-2xl font-medium max-w-3xl leading-relaxed">Provision and manage secure communication endpoints for your zonal infrastructure. Decentralized control for global nodes.</p>
                        </header>

                        <div className="grid lg:grid-cols-12 gap-10 xl:gap-16">
                            {/* Provision Form */}
                            <section className="lg:col-span-5 bg-white dark:bg-slate-900 p-8 lg:p-12 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-2xl shadow-slate-200/50 dark:shadow-none h-fit">
                                <div className="flex items-center gap-4 mb-10">
                                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-slate-900 shadow-lg shadow-emerald-500/20"><Plus className="w-6 h-6" /></div>
                                    <h3 className="font-black text-slate-900 dark:text-white text-2xl tracking-tight">New Account</h3>
                                </div>
                                <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Alias</label>
                                        <div className="flex items-center group transition-all">
                                            <input type="text" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="flex-1 p-4 bg-slate-50 dark:bg-white/10 text-slate-900 dark:text-white border-none rounded-l-2xl focus:ring-4 focus:ring-emerald-500/5 font-bold text-sm transition-all" placeholder="partner_name" />
                                            <span className="inline-flex items-center px-5 h-[52px] bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-r-2xl font-black text-xs border-l border-slate-200 dark:border-white/10">@fonzkart.in</span>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Keyphrase</label>
                                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-white/10 text-slate-900 dark:text-white border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/5 font-bold text-sm" placeholder="Secure Password" />
                                    </div>
                                    <button type="button" onClick={handleCreateAccount} disabled={isCreating} className="w-full bg-slate-950 dark:bg-emerald-600 hover:bg-slate-900 border border-white/10 dark:hover:bg-emerald-500 text-white p-5 rounded-2xl font-black shadow-2xl transition-all active:scale-[0.97] uppercase tracking-widest text-xs">
                                        {isCreating ? 'Provisioning...' : 'Deploy Mailbox'}
                                    </button>
                                </form>
                            </section>

                            {/* Live Accounts List */}
                            <section className="lg:col-span-7 space-y-8">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-500/10 dark:bg-emerald-500/10 text-blue-500 dark:text-emerald-400 rounded-2xl flex items-center justify-center"><CheckCircle2 className="w-6 h-6" /></div>
                                        <h3 className="font-black text-slate-800 dark:text-white text-2xl tracking-tight">Active Mailboxes</h3>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-4 py-1.5 rounded-full border border-emerald-500/20 uppercase tracking-widest leading-none">{reachableEmails.length} Total Nodes</span>
                                    </div>
                                </div>
                                <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-5">
                                    {reachableEmails.map((accEmail) => (
                                        <div key={accEmail} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 flex items-center justify-between group hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:border-emerald-500/50 transition-all duration-500">
                                            <div className="flex items-center gap-5 min-w-0">
                                                <div className="w-14 h-14 rounded-3xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition-all shrink-0"><User className="w-7 h-7" /></div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-slate-800 dark:text-slate-100 text-base truncate pr-2 tracking-tight">{accEmail}</p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                        <p className="text-[9px] text-emerald-500 font-black uppercase tracking-[.15em]">Live & Routing</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteEmailAccount(accEmail)}
                                                className="p-3 text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl transition-all shrink-0 ml-4 group/delete"
                                                title="Delete Account"
                                            >
                                                <Trash2 className="w-5 h-5 transition-transform group-hover/delete:scale-110" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );

  async function handleCreateAccount() {
    if (!newEmail || !newPassword) return alert('Email and Password are required');
    setIsCreating(true);
    try {
      const res = await fetch('/api/email/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword }),
      });
      if (res.ok) {
        setNewEmail(''); setNewPassword(''); loadEmails(true);
      } else {
        const error = await res.json(); alert('Error: ' + (error.message || error.error));
      }
    } catch (e: any) { alert('Error: ' + e.message); } finally { setIsCreating(false); }
  }

  async function handleDeleteEmailAccount(email: string) {
      if (!confirm(`Permanently delete ${email}? This will remove all messages and the mailbox on VPS.`)) return;
      setIsLoading(true);
      try {
          const res = await deleteEmailAccountAction(email);
          if (res.success) {
              alert('Account removed successfully');
              await loadEmails(true);
          } else {
              alert(res.error || 'Failed to delete');
          }
      } catch (e) {
          alert('Network error during deletion');
      } finally {
          setIsLoading(false);
      }
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    setIsSending(true);
    try {
      const formData = new FormData();
      formData.append('fromAccount', selectedAccount || 'support@fonzkart.in');
      formData.append('to', composeTo);
      formData.append('subject', composeSubject);
      formData.append('text', composeBody);
      const res = await fetch('/api/email/send', { method: 'POST', body: formData });
      if (res.ok) {
        setComposeTo(''); setComposeSubject(''); setComposeBody(''); setAttachments([]);
        setActiveTab('sent'); loadEmails(true);
      } else {
        const error = await res.json(); alert('Error: ' + error.message);
      }
    } catch (e: any) { alert('Error: ' + e.message); } finally { setIsSending(false); }
  }
}
