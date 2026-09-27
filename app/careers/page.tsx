'use client';

import React, { useState } from 'react';
import {
    Briefcase,
    MapPin,
    Clock,
    IndianRupee,
    GraduationCap,
    CheckCircle2,
    ArrowRight,
    Sparkles,
    Bike,
    FileSpreadsheet,
    X,
    Phone,
    Mail,
    Check,
    Compass,
    FileText,
    Download,
    Eye,
    Users
} from 'lucide-react';

interface JobRole {
    id: string;
    title: string;
    department: string;
    location: string;
    type: string;
    experience: string;
    compensation: string;
    badge: string;
    positions: number;
    icon: React.ElementType;
    overview: string;
    responsibilities: string[];
    requirements: string[];
    perks: string[];
    posterPdfUrl?: string;
    posterPngUrl?: string;
    posterPreviewUrl?: string;
}

const JOB_OPENINGS: JobRole[] = [
    {
        id: 'accountant',
        title: 'Accountant & Operations Executive',
        department: 'Finance, Accounts & Admin',
        location: 'Bangalore Office (Hegde Nagar / SRK Nagar)',
        type: 'Full-Time | On-Site',
        experience: '1 – 3 Years',
        compensation: 'Competitive Monthly Salary + Performance Bonus',
        badge: '2 Open Positions',
        positions: 2,
        icon: FileSpreadsheet,
        overview:
            'We are seeking a detail-oriented Accountant to take charge of daily financial bookkeeping, office administration, and transaction reconciliation on the FonzKart Admin Panel. You will work closely with management, coordinating with field executives to ensure zero cash/UPI discrepancy and maintaining crystal-clear ledgers.',
        responsibilities: [
            'Master and operate the FonzKart Admin Panel to verify completed gadget pickup orders, validate device grades, and approve payouts.',
            'Perform daily end-of-day reconciliations of rider cash handovers and instant UPI payments against system records.',
            'Maintain daybooks, general ledgers, accounts payable, accounts receivable, and banking records in Tally ERP and MS Excel.',
            'Generate GST-compliant invoices for corporate bulk sales, e-waste scrap recycling, and vendor settlements.',
            'Manage office administration, petty cash handling, courier & logistics partner payments, and documentation.',
            'Coordinate with senior leadership and Chartered Accountants for monthly GST filing, TDS deductions, and profit & loss statements.'
        ],
        requirements: [
            'Bachelor’s or Master’s degree in Commerce / Accounting (B.Com, M.Com, BBA Finance, or equivalent).',
            '1 to 3 years of hands-on experience in accounting, bookkeeping, and reconciliation (e-commerce/logistics experience is a plus).',
            'Proficiency in Tally Prime / ERP 9 and Advanced MS Excel (VLOOKUP, Pivot Tables, SUMIFS, Bank Recs).',
            'Comfort with web-based SaaS admin portals and digital transaction tracking.',
            'High personal integrity, numerical accuracy, and effective communication skills.'
        ],
        perks: [
            'Fixed monthly salary with bi-annual performance evaluations',
            'Direct collaboration with founding and management teams',
            'Hands-on exposure to circular commerce & tech-enabled logistics',
            'Friendly office culture and supportive work environment'
        ],
        posterPdfUrl: '/careers/posters/poster_accountant_hiring.pdf',
        posterPngUrl: '/careers/posters/poster_accountant_hiring_300dpi.png',
        posterPreviewUrl: '/careers/posters/poster_accountant_hiring_preview.png'
    },
    {
        id: 'field-executive',
        title: 'Field Executive / Device Evaluation Specialist',
        department: 'Field Operations & Logistics',
        location: 'Bangalore (Assigned Routes & Hubs)',
        type: 'Full-Time | On-Field',
        experience: '0 – 2 Years (Freshers Welcome)',
        compensation: 'Fixed Salary + Daily Fuel/Travel Allowance + High Per-Pickup Commission',
        badge: '5 Open Positions',
        positions: 5,
        icon: Bike,
        overview:
            'Be the face of FonzKart on the ground! As a Field Executive, you will travel to customer doorsteps across Bangalore to evaluate pre-owned smartphones and gadgets, confirm transparent spot valuations, initiate instant digital payouts, and safely transport devices to the central hub.',
        responsibilities: [
            'Visit customer locations across Bangalore according to pickup slots scheduled via the FonzKart Rider App.',
            'Conduct hands-on diagnosis of smartphones: screen responsiveness, camera lenses, battery health, speakers/mics, biometric sensors, ports, and IMEI verification.',
            'Evaluate physical cosmetic condition (scratches, dents, signs of wear) against standard FonzKart grading parameters.',
            'Confirm the instant quote price with the customer and initiate immediate digital spot payment (UPI/IMPS).',
            'Securely package, barcode-tag, and transport collected devices to the central Bangalore warehouse hub daily.',
            'Deliver a courteous, professional, and transparent doorstep experience to every customer.'
        ],
        requirements: [
            '10+2 (High School) or Any Graduate. Enthusiastic freshers passionate about gadgets are welcome to apply.',
            'Mandatory: Must possess a valid Two-Wheeler Driving License and your own Two-Wheeler (Bike/Scooter).',
            'Must own an Android or iOS smartphone with an active mobile internet connection for app navigation and testing.',
            'Basic curiosity and understanding of smartphone brands, settings, and hardware checks.',
            'Polite, punctual, and customer-first mindset with conversational ability in Kannada, English, or Hindi.'
        ],
        perks: [
            'Fixed base salary + generous daily fuel and travel allowances',
            'Exciting per-order pickup incentives and spot performance bonuses',
            'Fast-track promotion to Hub In-Charge / City Team Lead',
            'Flexible route dispatching powered by smart route-planning tools'
        ],
        posterPdfUrl: '/careers/posters/poster_field_executive_hiring.pdf',
        posterPngUrl: '/careers/posters/poster_field_executive_hiring_300dpi.png',
        posterPreviewUrl: '/careers/posters/poster_field_executive_hiring_preview.png'
    }
];

export default function CareersPage() {
    const [activeTab, setActiveTab] = useState<'all' | 'accountant' | 'field-executive'>('all');
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [applyingForRole, setApplyingForRole] = useState<string>('Accountant & Operations Executive');

    // Application Form State
    const [formState, setFormState] = useState({
        name: '',
        phone: '',
        email: '',
        role: 'Accountant & Operations Executive',
        experience: '1 - 2 Years',
        location: 'Bangalore',
        hasBikeAndLicense: 'Yes',
        resumeUrl: '',
        message: ''
    });

    const [formSubmitted, setFormSubmitted] = useState(false);

    const openApplyModal = (roleTitle: string) => {
        setApplyingForRole(roleTitle);
        setFormState((prev) => ({ ...prev, role: roleTitle }));
        setIsApplyModalOpen(true);
        setFormSubmitted(false);
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormSubmitted(true);
    };

    // Compose pre-filled WhatsApp message
    const getWhatsAppUrl = () => {
        const text = `*New Job Application - FonzKart Careers*
*Name:* ${formState.name || 'Applicant'}
*Applying For:* ${formState.role}
*Phone:* ${formState.phone}
*Email:* ${formState.email}
*Experience:* ${formState.experience}
*Location:* ${formState.location}
${formState.role.includes('Field') ? `*Has Bike & License:* ${formState.hasBikeAndLicense}\n` : ''}*Resume/Profile Link:* ${formState.resumeUrl || 'Will share over chat'}
*Note:* ${formState.message || 'I would like to apply for this opening at FonzKart.'}`;

        return `https://wa.me/919060336060?text=${encodeURIComponent(text)}`;
    };

    // Compose pre-filled Email link
    const getMailtoUrl = () => {
        const subject = `Application for ${formState.role} - ${formState.name || 'Applicant'}`;
        const body = `Dear FonzKart Hiring Team,

I am writing to express my strong interest in the ${formState.role} position at FonzKart.

Applicant Details:
- Name: ${formState.name}
- Phone: ${formState.phone}
- Email: ${formState.email}
- Experience: ${formState.experience}
- Location: ${formState.location}
${formState.role.includes('Field') ? `- Two-Wheeler & License: ${formState.hasBikeAndLicense}\n` : ''}- Resume / Portfolio Link: ${formState.resumeUrl || '[Attached]'}

Brief Cover Note:
${formState.message || 'Looking forward to hearing from your recruitment team.'}

Best regards,
${formState.name || 'Applicant'}`;

        return `mailto:careers@fonzkart.in?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    const filteredRoles = JOB_OPENINGS.filter((job) => {
        if (activeTab === 'all') return true;
        return job.id === activeTab;
    });

    return (
        <div className="min-h-screen bg-background text-foreground pb-20">
            {/* Hero Section */}
            <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-primary/10 via-background to-background pt-16 pb-20 md:pt-24 md:pb-28">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent pointer-events-none" />
                
                <div className="container mx-auto px-4 md:px-6 relative z-10 max-w-5xl text-center space-y-6">
                    {/* Badge / Chip */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs whitespace-nowrap max-w-full overflow-hidden">
                        <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="font-semibold text-foreground/90">Hiring in Bangalore</span>
                        <span className="h-3.5 w-px bg-emerald-500/40 shrink-0" />
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 font-black text-[11px] shrink-0 shadow-2xs">
                            7 Open Positions (2 Roles)
                        </span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
                        Shape the Future of <br className="hidden sm:inline" />
                        <span className="bg-gradient-to-r from-emerald-600 via-green-500 to-teal-500 bg-clip-text text-transparent">
                            Circular Gadget Commerce
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        Join FonzKart (NR Waste Management Pvt. Ltd.) in Bangalore. We are building India&apos;s fastest, most transparent trade-in and re-commerce network for smartphones and electronics.
                    </p>

                    {/* Highlights Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-6 max-w-3xl mx-auto">
                        <div className="p-4 rounded-2xl bg-card/60 border border-border/60 shadow-xs">
                            <div className="text-xl sm:text-2xl font-bold text-primary">10,000+</div>
                            <div className="text-xs text-muted-foreground mt-0.5">Devices Recycled</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-card/60 border border-border/60 shadow-xs">
                            <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">Instant</div>
                            <div className="text-xs text-muted-foreground mt-0.5">Doorstep Payouts</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-card/60 border border-border/60 shadow-xs">
                            <div className="text-xl sm:text-2xl font-bold text-primary">Bangalore</div>
                            <div className="text-xs text-muted-foreground mt-0.5">Central Hub HQ</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-card/60 border border-border/60 shadow-xs">
                            <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">7 Positions</div>
                            <div className="text-xs text-muted-foreground mt-0.5">Actively Hiring</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why Work With Us Section */}
            <section className="container mx-auto px-4 md:px-6 py-16 max-w-6xl">
                <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                        Why Build Your Career at FonzKart?
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        We blend cutting-edge logistics, smart diagnostic tech, and transparent operations to provide our team with real-world impact and high earning potential.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 rounded-3xl bg-card border border-border/60 shadow-xs space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                            <IndianRupee className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">Top-Tier Incentives &amp; Allowances</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Competitive fixed base salaries complemented by daily travel allowances, per-pickup commission bonuses, and spot rewards for exceptional performance.
                        </p>
                    </div>

                    <div className="p-6 rounded-3xl bg-card border border-border/60 shadow-xs space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">Modern Admin &amp; Rider Tools</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Work with our proprietary FonzKart Admin Panel and Rider App. Learn live order validation, automated grading workflows, and digital reconciliation.
                        </p>
                    </div>

                    <div className="p-6 rounded-3xl bg-card border border-border/60 shadow-xs space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                            <Compass className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">Fast-Track Leadership Path</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            No rigid corporate hierarchy. High performers rapidly graduate to Hub In-Charge, Zonal Leads, or Senior Financial Controllers as we scale.
                        </p>
                    </div>
                </div>
            </section>

            {/* Open Roles Section */}
            <section id="open-positions" className="container mx-auto px-4 md:px-6 py-8 max-w-6xl space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/60 pb-6">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary mb-1">
                            <Briefcase className="h-4 w-4" />
                            Active Openings
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">
                            Explore Current Opportunities
                        </h2>
                    </div>

                    {/* Filter Tabs */}
                    <div className="inline-flex p-1 rounded-2xl bg-muted/60 border border-border/60 text-xs font-semibold">
                        <button
                            type="button"
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-2 rounded-xl transition-all ${
                                activeTab === 'all'
                                    ? 'bg-background text-foreground shadow-xs font-bold'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            All Openings (7 Positions)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('accountant')}
                            className={`px-4 py-2 rounded-xl transition-all ${
                                activeTab === 'accountant'
                                    ? 'bg-background text-foreground shadow-xs font-bold'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Accountant (2 Positions)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('field-executive')}
                            className={`px-4 py-2 rounded-xl transition-all ${
                                activeTab === 'field-executive'
                                    ? 'bg-background text-foreground shadow-xs font-bold'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Field Executive (5 Positions)
                        </button>
                    </div>
                </div>

                {/* Job Cards Grid */}
                <div className="grid grid-cols-1 gap-8">
                    {filteredRoles.map((job) => {
                        const IconComponent = job.icon;

                        return (
                            <div
                                key={job.id}
                                className="group relative rounded-3xl border border-border/60 bg-card p-6 sm:p-8 shadow-xs hover:shadow-xl hover:border-primary/40 transition-all duration-300"
                            >
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                                    <div className="space-y-4 flex-1">
                                        {/* Header Row */}
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                <IconComponent className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                        {job.department}
                                                    </span>
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                                        {job.badge}
                                                    </span>
                                                </div>
                                                <h3 className="text-xl sm:text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                                                    {job.title}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Meta Pills */}
                                        <div className="flex flex-wrap gap-2.5 text-xs text-muted-foreground">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">
                                                <Users className="h-3.5 w-3.5 text-primary" />
                                                {job.positions} Open Positions
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/60 border border-border/40 font-medium">
                                                <MapPin className="h-3.5 w-3.5 text-primary" />
                                                {job.location}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/60 border border-border/40 font-medium">
                                                <Clock className="h-3.5 w-3.5 text-primary" />
                                                {job.type}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/60 border border-border/40 font-medium">
                                                <GraduationCap className="h-3.5 w-3.5 text-primary" />
                                                Exp: {job.experience}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                                                <IndianRupee className="h-3.5 w-3.5" />
                                                {job.compensation}
                                            </span>
                                        </div>

                                        {/* Overview */}
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {job.overview}
                                        </p>

                                        {/* Key Responsibilities */}
                                        <div className="space-y-2 pt-2">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                                Core Responsibilities:
                                            </h4>
                                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                                                {job.responsibilities.map((resp, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                                        <span>{resp}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Requirements */}
                                        <div className="space-y-2 pt-2">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                                What We Are Looking For:
                                            </h4>
                                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                                                {job.requirements.map((req, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                                        <span>{req}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Perks */}
                                        <div className="space-y-2 pt-2">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                                Perks &amp; Benefits:
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {job.perks.map((perk, i) => (
                                                    <span
                                                        key={i}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary/5 text-primary text-xs font-medium border border-primary/15"
                                                    >
                                                        <Sparkles className="h-3 w-3" />
                                                        {perk}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons Column */}
                                    <div className="lg:w-60 flex flex-col gap-3 pt-4 lg:pt-0 lg:border-l lg:border-border/60 lg:pl-6 shrink-0 justify-center">
                                        <button
                                            type="button"
                                            onClick={() => openApplyModal(job.title)}
                                            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 dark:from-emerald-500 dark:to-green-500 text-white font-bold py-3 px-5 shadow-md shadow-green-600/20 hover:shadow-lg hover:shadow-green-600/30 hover:-translate-y-0.5 transition-all duration-200 text-sm"
                                        >
                                            <span>Apply Now</span>
                                            <ArrowRight className="h-4 w-4" />
                                        </button>

                                        {/* Direct 1-Click WhatsApp Apply */}
                                        <a
                                            href={`https://wa.me/919060336060?text=${encodeURIComponent(
                                                `Hi FonzKart Hiring Team, I am interested in applying for the *${job.title}* opening at your Bangalore location. Here is my background:`
                                            )}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold py-2.5 px-4 text-xs transition-colors"
                                        >
                                            <Phone className="h-3.5 w-3.5" />
                                            <span>Quick Apply on WhatsApp</span>
                                        </a>

                                        {/* Direct Email Apply */}
                                        <a
                                            href={`mailto:careers@fonzkart.in?subject=${encodeURIComponent(
                                                `Job Application: ${job.title}`
                                            )}`}
                                            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-border/80 bg-background hover:bg-accent text-muted-foreground hover:text-foreground font-semibold py-2.5 px-4 text-xs transition-colors"
                                        >
                                            <Mail className="h-3.5 w-3.5" />
                                            <span>Email CV to careers@</span>
                                        </a>

                                        {/* Download Official Poster (PDF) */}
                                        {job.posterPdfUrl && (
                                            <a
                                                href={job.posterPdfUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                download
                                                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-semibold py-2.5 px-4 text-xs transition-colors"
                                            >
                                                <FileText className="h-3.5 w-3.5 shrink-0" />
                                                <span>Official Poster (PDF)</span>
                                            </a>
                                        )}

                                        <p className="text-[11px] text-center text-muted-foreground mt-1">
                                            Immediate joining preferred in Bangalore.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Official Recruitment Posters Showcase Section */}
            <section className="container mx-auto px-4 md:px-6 py-12 max-w-6xl">
                <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card/90 to-accent/20 p-6 sm:p-10 shadow-sm space-y-8">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/60 pb-6">
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                <Sparkles className="h-3.5 w-3.5" />
                                Official Hiring Notices &amp; Flyers
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                                Official Recruitment Posters
                            </h3>
                            <p className="text-sm text-muted-foreground max-w-2xl">
                                Issued by <strong>NR Waste Management Private Limited</strong> and <strong>FonzKart</strong>. Print-ready A4 PDFs and ultra-high-resolution 300 DPI graphics for digital sharing, notice boards, and candidate referral.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Poster 1: Accountant */}
                        <div className="flex flex-col sm:flex-row gap-6 p-6 rounded-3xl bg-background/80 border border-border/80 shadow-sm hover:shadow-md transition-all">
                            <div className="sm:w-44 shrink-0 rounded-2xl overflow-hidden border border-border shadow-xs bg-muted">
                                <a
                                    href="/careers/posters/poster_accountant_hiring_300dpi.png"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block group relative"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="/careers/posters/poster_accountant_hiring_preview.png"
                                        alt="Official Hiring Poster - Accountant & Operations Executive"
                                        className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold gap-1.5 transition-opacity">
                                        <Eye className="h-4 w-4" />
                                        <span>Preview</span>
                                    </div>
                                </a>
                            </div>
                            <div className="flex flex-col justify-between space-y-4 flex-1">
                                <div className="space-y-2">
                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
                                        2 Positions • Finance &amp; Admin
                                    </span>
                                    <h4 className="text-lg font-bold text-foreground">
                                        Accountant &amp; Operations Executive
                                    </h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Office accounts, Tally Prime / Excel, FonzKart Admin Panel validation, rider cash &amp; UPI reconciliations.
                                    </p>
                                </div>
                                <div className="space-y-2 pt-2">
                                    <a
                                        href="/careers/posters/poster_accountant_hiring.pdf"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download="FonzKart_Accountant_Hiring_Poster.pdf"
                                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold py-2.5 px-4 text-xs hover:bg-primary/90 transition-colors shadow-xs"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        <span>Download Print PDF (1.6 MB)</span>
                                    </a>
                                    <a
                                        href="/careers/posters/poster_accountant_hiring_300dpi.png"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download="FonzKart_Accountant_Hiring_Poster_300DPI.png"
                                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-accent text-foreground font-semibold py-2 px-4 text-xs transition-colors"
                                    >
                                        <FileText className="h-3.5 w-3.5 text-primary" />
                                        <span>Download 300 DPI PNG</span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Poster 2: Field Executive */}
                        <div className="flex flex-col sm:flex-row gap-6 p-6 rounded-3xl bg-background/80 border border-border/80 shadow-sm hover:shadow-md transition-all">
                            <div className="sm:w-44 shrink-0 rounded-2xl overflow-hidden border border-border shadow-xs bg-muted">
                                <a
                                    href="/careers/posters/poster_field_executive_hiring_300dpi.png"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block group relative"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="/careers/posters/poster_field_executive_hiring_preview.png"
                                        alt="Official Hiring Poster - Field Executive & Device Evaluation Specialist"
                                        className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold gap-1.5 transition-opacity">
                                        <Eye className="h-4 w-4" />
                                        <span>Preview</span>
                                    </div>
                                </a>
                            </div>
                            <div className="flex flex-col justify-between space-y-4 flex-1">
                                <div className="space-y-2">
                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                        5 Positions • Field Operations
                                    </span>
                                    <h4 className="text-lg font-bold text-foreground">
                                        Field Executive / Evaluation Specialist
                                    </h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Doorstep gadget evaluations across Bangalore, instant customer digital payouts, route dispatching &amp; collection.
                                    </p>
                                </div>
                                <div className="space-y-2 pt-2">
                                    <a
                                        href="/careers/posters/poster_field_executive_hiring.pdf"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download="FonzKart_Field_Executive_Hiring_Poster.pdf"
                                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 text-xs transition-colors shadow-xs"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        <span>Download Print PDF (1.6 MB)</span>
                                    </a>
                                    <a
                                        href="/careers/posters/poster_field_executive_hiring_300dpi.png"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download="FonzKart_Field_Executive_Hiring_Poster_300DPI.png"
                                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-accent text-foreground font-semibold py-2 px-4 text-xs transition-colors"
                                    >
                                        <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                        <span>Download 300 DPI PNG</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* General Openings Callout */}
            <section className="container mx-auto px-4 md:px-6 py-12 max-w-6xl">
                <div className="rounded-3xl border border-border/60 bg-gradient-to-r from-card via-accent/30 to-card p-8 md:p-12 shadow-sm text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-2 max-w-2xl">
                        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
                            Don&apos;t see the exact role you&apos;re looking for?
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            We are constantly expanding our Bangalore operations, technology, logistics, and customer support teams. Drop us your resume and we will contact you as soon as a fitting position opens.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                        <a
                            href="mailto:careers@fonzkart.in?subject=Spontaneous%20Application%20-%20FonzKart"
                            className="inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold px-6 py-3 text-sm hover:bg-primary/90 transition-colors shadow-xs"
                        >
                            <Mail className="h-4 w-4" />
                            <span>careers@fonzkart.in</span>
                        </a>
                        <a
                            href="https://wa.me/919060336060?text=Hi%20FonzKart%20Careers%20Team%2C%20I%20am%20interested%20in%20joining%20FonzKart.%20Here%20is%20my%20profile%3A"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-background hover:bg-accent font-semibold px-5 py-3 text-sm text-foreground transition-colors"
                        >
                            <Phone className="h-4 w-4 text-emerald-500" />
                            <span>WhatsApp Recruitment Desk</span>
                        </a>
                    </div>
                </div>
            </section>

            {/* Interactive Application Modal */}
            {isApplyModalOpen && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Apply for ${applyingForRole}`}
                >
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
                        onClick={() => setIsApplyModalOpen(false)}
                        aria-hidden="true"
                    />

                    {/* Modal Box */}
                    <div className="relative z-10 w-full max-w-lg rounded-3xl border border-border/80 bg-background p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto text-foreground">
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => setIsApplyModalOpen(false)}
                            className="absolute top-5 right-5 rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            aria-label="Close application modal"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        {!formSubmitted ? (
                            <form onSubmit={handleFormSubmit} className="space-y-5">
                                <div>
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mb-2">
                                        Bangalore Openings • 7 Positions Active
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-bold text-foreground">
                                        Apply for Position
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Fill in your details below. You can apply instantly via WhatsApp or Email.
                                    </p>
                                </div>

                                <div className="space-y-4 text-sm">
                                    {/* Position Selector */}
                                    <div>
                                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                                             Role Applying For *
                                        </label>
                                        <select
                                            value={formState.role}
                                            onChange={(e) => setFormState({ ...formState, role: e.target.value })}
                                            className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                                        >
                                            <option value="Accountant & Operations Executive">
                                                Accountant &amp; Operations Executive (2 Open Positions)
                                            </option>
                                            <option value="Field Executive / Device Evaluation Specialist">
                                                Field Executive / Device Evaluation Specialist (5 Open Positions)
                                            </option>
                                        </select>
                                    </div>

                                    {/* Full Name */}
                                    <div>
                                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                                            Full Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formState.name}
                                            onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                            placeholder="e.g. Ramesh Kumar"
                                            className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                        />
                                    </div>

                                    {/* Phone & Email Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                                                Mobile / WhatsApp No. *
                                            </label>
                                            <input
                                                type="tel"
                                                required
                                                value={formState.phone}
                                                onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                                                placeholder="+91 98765 43210"
                                                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                                                Email Address *
                                            </label>
                                            <input
                                                type="email"
                                                required
                                                value={formState.email}
                                                onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                                                placeholder="name@example.com"
                                                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Experience & Location */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                                                Experience *
                                            </label>
                                            <select
                                                value={formState.experience}
                                                onChange={(e) => setFormState({ ...formState, experience: e.target.value })}
                                                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                            >
                                                <option value="Fresher">Fresher (0 - 6 months)</option>
                                                <option value="6 months - 1 Year">6 months - 1 Year</option>
                                                <option value="1 - 2 Years">1 - 2 Years</option>
                                                <option value="2 - 4 Years">2 - 4 Years</option>
                                                <option value="4+ Years">4+ Years</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                                                Current Bangalore Area *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={formState.location}
                                                onChange={(e) => setFormState({ ...formState, location: e.target.value })}
                                                placeholder="e.g. Hegde Nagar, Thanisandra, Hebbal"
                                                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Conditional Two-Wheeler Question for Field Roles */}
                                    {formState.role.includes('Field') && (
                                        <div className="p-3.5 rounded-2xl bg-accent/40 border border-border/60">
                                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                                                Do you have your own Two-Wheeler &amp; valid Driving License? *
                                            </label>
                                            <div className="flex gap-4 text-xs font-medium">
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="bike"
                                                        value="Yes"
                                                        checked={formState.hasBikeAndLicense === 'Yes'}
                                                        onChange={(e) => setFormState({ ...formState, hasBikeAndLicense: e.target.value })}
                                                        className="text-primary focus:ring-primary"
                                                    />
                                                    Yes, have both
                                                </label>
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="bike"
                                                        value="No"
                                                        checked={formState.hasBikeAndLicense === 'No'}
                                                        onChange={(e) => setFormState({ ...formState, hasBikeAndLicense: e.target.value })}
                                                        className="text-primary focus:ring-primary"
                                                    />
                                                    No
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Resume / Portfolio Link */}
                                    <div>
                                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                                            Resume Link (Google Drive / LinkedIn / Dropbox)
                                        </label>
                                        <input
                                            type="url"
                                            value={formState.resumeUrl}
                                            onChange={(e) => setFormState({ ...formState, resumeUrl: e.target.value })}
                                            placeholder="https://drive.google.com/... or LinkedIn URL"
                                            className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                        />
                                    </div>

                                    {/* Brief Note */}
                                    <div>
                                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                                            Why are you a good fit for this role?
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={formState.message}
                                            onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                                            placeholder="Tell us briefly about your background and when you can join..."
                                            className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
                                        />
                                    </div>
                                </div>

                                {/* Application Submission CTAs */}
                                <div className="pt-2 space-y-2.5">
                                    <a
                                        href={getWhatsAppUrl()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold py-3.5 px-6 shadow-md hover:shadow-lg shadow-green-600/20 text-sm transition-all"
                                    >
                                        <Phone className="h-4 w-4" />
                                        <span>Submit Instantly via WhatsApp</span>
                                    </a>

                                    <a
                                        href={getMailtoUrl()}
                                        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-border/80 bg-accent/60 hover:bg-accent text-foreground font-semibold py-3 px-6 text-sm transition-colors"
                                    >
                                        <Mail className="h-4 w-4 text-primary" />
                                        <span>Send via Email to careers@fonzkart.in</span>
                                    </a>

                                    <p className="text-[11px] text-center text-muted-foreground">
                                        By clicking, your application details will be pre-filled for immediate review.
                                    </p>
                                </div>
                            </form>
                        ) : (
                            <div className="py-8 text-center space-y-4">
                                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto">
                                    <CheckCircle2 className="h-8 w-8" />
                                </div>
                                <h3 className="text-2xl font-bold text-foreground">
                                    Application Received!
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                                    Thank you for applying for the <strong className="text-foreground">{formState.role}</strong> position. Our recruiting team will review your details and connect with you shortly.
                                </p>
                                <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                                    <a
                                        href={getWhatsAppUrl()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white font-semibold px-5 py-2.5 text-xs shadow-sm hover:bg-emerald-700 transition-colors"
                                    >
                                        <Phone className="h-3.5 w-3.5" />
                                        Follow Up on WhatsApp
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => setIsApplyModalOpen(false)}
                                        className="inline-flex items-center justify-center rounded-xl border border-input px-5 py-2.5 text-xs font-semibold hover:bg-accent transition-colors"
                                    >
                                        Close Window
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
