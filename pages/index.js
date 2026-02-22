import { useState, useCallback, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import toast from 'react-hot-toast';

// Calls FastAPI directly in dev (avoids Next.js proxy timeout on long LLM calls).
// In production on Vercel, NEXT_PUBLIC_API_URL is unset so /api/* hits the same origin.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// Safely parse JSON — returns null if body is empty or not JSON (e.g. Vercel 504 timeout).
async function safeJson(res) {
    try { return await res.json(); } catch { return null; }
}

// ─── Animation Variants ────────────────────────────────────────────────────────
const fadeUp = {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: 'easeIn' } },
};

const stagger = {
    show: { transition: { staggerChildren: 0.1 } },
};

const scaleIn = {
    hidden: { opacity: 0, scale: 0.88 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
    exit: { opacity: 0, scale: 0.92, transition: { duration: 0.25 } },
};

// ─── Floating Particles Component ──────────────────────────────────────────────
function Particles() {
    const [particles, setParticles] = useState([]);

    useEffect(() => {
        const colors = ['#7c5cfc', '#38bdf8', '#34d399', '#a78bfa'];
        const p = Array.from({ length: 18 }, (_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            width: `${Math.random() * 4 + 2}px`,
            height: `${Math.random() * 4 + 2}px`,
            color: colors[Math.floor(Math.random() * colors.length)],
            duration: `${Math.random() * 14 + 10}s`,
            delay: `${Math.random() * 10}s`,
        }));
        setParticles(p);
    }, []);

    return (
        <>
            {particles.map(p => (
                <div
                    key={p.id}
                    className="particle"
                    style={{
                        left: p.left,
                        width: p.width,
                        height: p.height,
                        background: p.color,
                        animationDuration: p.duration,
                        animationDelay: p.delay,
                        boxShadow: `0 0 6px ${p.color}`,
                    }}
                />
            ))}
        </>
    );
}

// ─── Animated Counter ──────────────────────────────────────────────────────────
function AnimCounter({ value }) {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        let start = 0;
        const target = parseFloat(value) || 0;
        if (target === 0) { setDisplay(0); return; }
        const step = target / 30;
        const timer = setInterval(() => {
            start += step;
            if (start >= target) { setDisplay(target); clearInterval(timer); }
            else setDisplay(Math.round(start * 10) / 10);
        }, 20);
        return () => clearInterval(timer);
    }, [value]);
    return <span>{display}</span>;
}

// ─── Step Indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }) {
    const steps = ['Upload Resume', 'Job Details', 'Cover Letter'];
    return (
        <div className="step-indicator" style={{ marginBottom: '48px' }}>
            {steps.map((label, i) => {
                const idx = i + 1;
                const state = idx < current ? 'done' : idx === current ? 'active' : 'idle';
                return (
                    <div key={i} className="step-item" style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <motion.div
                                className={`step-bubble ${state}`}
                                animate={state === 'active' ? { boxShadow: ['0 0 0px rgba(124,92,252,0)', '0 0 22px rgba(124,92,252,0.6)', '0 0 0px rgba(124,92,252,0)'] } : {}}
                                transition={{ repeat: Infinity, duration: 2.2 }}
                            >
                                {state === 'done' ? '✓' : idx}
                                <span className={`step-label ${state}`}>{label}</span>
                            </motion.div>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`step-connector ${state === 'done' ? 'done' : ''}`} style={{ margin: '0 6px' }} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Typewriter Effect ─────────────────────────────────────────────────────────
function Typewriter({ text }) {
    const [displayed, setDisplayed] = useState('');
    useEffect(() => {
        setDisplayed('');
        let i = 0;
        const timer = setInterval(() => {
            setDisplayed(text.slice(0, i + 1));
            i++;
            if (i >= text.length) clearInterval(timer);
        }, 6);
        return () => clearInterval(timer);
    }, [text]);
    return <span>{displayed}</span>;
}

// ─── Experience Gap Banner ─────────────────────────────────────────────────────
function GapBanner({ result }) {
    if (!result) return null;
    const isGap = result.gap_detected;
    return (
        <motion.div
            className={`gap-banner ${isGap ? 'warn' : 'ok'}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <span className="gap-banner-icon">{isGap ? '⚠️' : '✅'}</span>
            <div className="gap-banner-body">
                <div className="gap-banner-title">
                    {isGap ? 'Experience Gap Detected' : 'Experience Check Passed'}
                </div>
                <div className="gap-banner-desc">
                    {isGap
                        ? `Job requires ${result.required} yrs · You have ${result.user} yrs`
                        : `Job requires ${result.required}+ yrs — you're good to go!`}
                </div>
            </div>
        </motion.div>
    );
}

// ─── Profile Preview ───────────────────────────────────────────────────────────
function ProfilePreview({ profile }) {
    const info = profile?.personal_info || {};
    const fields = [
        { label: 'Name', val: info.full_name },
        { label: 'Email', val: info.email },
        { label: 'Location', val: info.location },
        { label: 'Phone', val: info.phone },
        { label: 'Skills', val: (profile?.core_competencies || []).slice(0, 3).map(c => c.skill).join(', ') },
        { label: 'Education', val: (profile?.education || [])[0]?.institution },
    ].filter(f => f.val);

    return (
        <motion.div className="profile-grid" variants={stagger} initial="hidden" animate="show">
            {fields.map((f, i) => (
                <motion.div key={i} className="profile-chip" variants={fadeUp}>
                    <strong>{f.label}</strong>
                    <span>{f.val}</span>
                </motion.div>
            ))}
        </motion.div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
    const [step, setStep] = useState(1);
    const [profile, setProfile] = useState(null);
    const [yoe, setYoe] = useState('2');
    const [company, setCompany] = useState('');
    const [role, setRole] = useState('');
    const [jd, setJd] = useState('');
    const [gapResult, setGapResult] = useState(null);
    const [coverLetter, setCoverLetter] = useState('');
    const [customInstruction, setCustomInstruction] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [fileName, setFileName] = useState('');
    const letterRef = useRef(null);

    // Drag-and-drop file upload
    const onDrop = useCallback(async (accepted) => {
        const file = accepted[0];
        if (!file) return;
        setFileName(file.name);
        setLoadingMsg('Parsing your resume with AI…');
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch(`${API_BASE}/api/upload-resume`, { method: 'POST', body: fd });
            if (!res.ok) {
                const err = await safeJson(res);
                throw new Error(err?.detail || `Server error ${res.status} — check your API key and try again.`);
            }
            const data = await res.json();
            // Inject YoE
            if (data.profile?.personal_info) {
                data.profile.personal_info.explicit_years_of_experience = yoe;
            }
            setProfile(data.profile);
            toast.success('Resume parsed successfully!');
        } catch (e) {
            toast.error(e.message);
        } finally {
            setLoading(false);
            setLoadingMsg('');
        }
    }, [yoe]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
        maxFiles: 1,
    });

    // Step 1 → 2
    const handleNext1 = () => {
        if (!profile) return toast.error('Please upload your resume first.');
        // Update YoE in profile
        if (profile?.personal_info) {
            setProfile(p => ({ ...p, personal_info: { ...p.personal_info, explicit_years_of_experience: yoe } }));
        }
        setStep(2);
    };

    // Step 2: generate cover letter
    const handleGenerate = async () => {
        if (!company.trim()) return toast.error('Enter company name.');
        if (!role.trim()) return toast.error('Enter job role.');
        if (!jd.trim()) return toast.error('Paste the job description.');

        setLoadingMsg('Checking experience fit…');
        setLoading(true);

        try {
            // Experience check
            const checkRes = await fetch(`${API_BASE}/api/experience-check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_description: jd, user_yoe: yoe }),
            });
            const checkData = await checkRes.json();
            setGapResult(checkData);

            setLoadingMsg('Generating your cover letter…');

            const genRes = await fetch(`${API_BASE}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company, role, description: jd,
                    candidate_profile: profile,
                    user_yoe: yoe,
                }),
            });
            if (!genRes.ok) {
                const err = await safeJson(genRes);
                throw new Error(err?.detail || `Server error ${genRes.status} — generation failed.`);
            }
            const genData = await genRes.json();
            setCoverLetter(genData.cover_letter);
            setStep(3);
            toast.success('Cover letter generated!');
        } catch (e) {
            toast.error(e.message);
        } finally {
            setLoading(false);
            setLoadingMsg('');
        }
    };

    // Refine cover letter
    const handleRefine = async (instruction) => {
        if (!instruction.trim()) return toast.error('Enter a refinement instruction.');
        setLoadingMsg('Refining…');
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/refine`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_letter: coverLetter,
                    instruction,
                    company, role, description: jd,
                    candidate_profile: profile,
                }),
            });
            if (!res.ok) { const e = await safeJson(res); throw new Error(e?.detail || `Server error ${res.status}`); }
            const data = await res.json();
            setCoverLetter(data.cover_letter);
            setCustomInstruction('');
            toast.success('Letter refined!');
        } catch (e) {
            toast.error(e.message);
        } finally {
            setLoading(false);
            setLoadingMsg('');
        }
    };

    // Copy to clipboard
    const handleCopy = () => {
        navigator.clipboard.writeText(coverLetter);
        toast.success('Copied to clipboard!');
    };

    // Download as .txt
    const handleDownload = () => {
        const blob = new Blob([coverLetter], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Cover_Letter_${company.replace(/\s+/g, '_')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Downloaded!');
    };

    const refinements = [
        { label: '✂️  Make it more concise', instruction: 'Make it more concise, crisp, and punchy. Remove filler.' },
        { label: '📝  Add more detail', instruction: 'Make it more detailed. Expand on problem-solving aspects professionally.' },
        { label: '🤝  Friendlier tone', instruction: 'Make the tone warmer and more personable while keeping it professional.' },
        { label: '🎯  More impactful opener', instruction: 'Rewrite the opening paragraph to be more compelling and direct.' },
    ];

    return (
        <>
            <Head>
                <title>Job Assistant — AI Cover Letter Generator</title>
                <meta name="description" content="Upload your resume, paste a JD, and get an AI-crafted cover letter in seconds." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✍️</text></svg>" />
            </Head>

            <div className="bg-mesh" aria-hidden />
            <Particles />

            <div className="app-shell">
                <div className="container">
                    {/* ── Header ── */}
                    <motion.header
                        className="header"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="logo-badge">
                            <span className="logo-dot" />
                            AI-Powered · Gemini 2.5 Flash
                        </div>
                        <h1 className="hero-title">Job Application<br />Assistant</h1>
                        <p className="hero-subtitle">
                            Upload your resume → paste a JD → get a precision-crafted cover letter.
                        </p>
                    </motion.header>

                    {/* ── Step Indicator ── */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                    >
                        <StepIndicator current={step} />
                    </motion.div>

                    {/* ── Step Panels ── */}
                    <AnimatePresence mode="wait">

                        {/* STEP 1: Upload */}
                        {step === 1 && (
                            <motion.div key="step1" variants={scaleIn} initial="hidden" animate="show" exit="exit">
                                <div className="card">
                                    <h2 className="card-title">📄 Upload Your Resume</h2>
                                    <p className="card-subtitle">We'll extract your details automatically. Supports PDF & DOCX.</p>

                                    <motion.div
                                        {...getRootProps()}
                                        className={`dropzone ${isDragActive ? 'active' : ''}`}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                    >
                                        <input {...getInputProps()} />
                                        <motion.span
                                            className="dropzone-icon"
                                            animate={{ y: [0, -8, 0] }}
                                            transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                                        >
                                            {isDragActive ? '📂' : '📎'}
                                        </motion.span>
                                        {loading ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                                <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                                                <p className="dropzone-text">{loadingMsg}</p>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="dropzone-text">
                                                    {isDragActive ? 'Drop it here!' : 'Drag & drop your resume, or click to browse'}
                                                </p>
                                                <p className="dropzone-hint">PDF or DOCX · Max 10 MB</p>
                                            </>
                                        )}
                                    </motion.div>

                                    <AnimatePresence>
                                        {fileName && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0 }}
                                                style={{ display: 'flex', justifyContent: 'center' }}
                                            >
                                                <div className="file-pill">✓ {fileName}</div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <AnimatePresence>
                                        {profile && <ProfilePreview profile={profile} />}
                                    </AnimatePresence>

                                    {profile && (
                                        <>
                                            <div className="divider" />
                                            <div className="form-field">
                                                <label className="form-label">Years of Experience</label>
                                                <div className="yoe-row">
                                                    <input
                                                        type="range" min="0" max="20" step="0.5"
                                                        value={yoe}
                                                        onChange={e => setYoe(e.target.value)}
                                                        className="yoe-slider"
                                                    />
                                                    <div className="yoe-value">
                                                        <AnimCounter value={yoe} /> yrs
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <motion.button
                                        className="btn btn-primary"
                                        style={{ marginTop: 24 }}
                                        onClick={handleNext1}
                                        disabled={!profile || loading}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.97 }}
                                    >
                                        Continue to Job Details →
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: Job Details */}
                        {step === 2 && (
                            <motion.div key="step2" variants={scaleIn} initial="hidden" animate="show" exit="exit">
                                <div className="card">
                                    <button className="back-btn" onClick={() => setStep(1)}>← Back</button>
                                    <h2 className="card-title">🎯 Job Details</h2>
                                    <p className="card-subtitle">Tell us about the position you're applying for.</p>

                                    <motion.div variants={stagger} initial="hidden" animate="show">
                                        <motion.div className="form-field" variants={fadeUp}>
                                            <label className="form-label">Company Name</label>
                                            <input
                                                className="form-input"
                                                placeholder="e.g. Google, Red Hat, Stripe"
                                                value={company}
                                                onChange={e => setCompany(e.target.value)}
                                            />
                                        </motion.div>

                                        <motion.div className="form-field" variants={fadeUp}>
                                            <label className="form-label">Job Role / Title</label>
                                            <input
                                                className="form-input"
                                                placeholder="e.g. Senior Software Engineer"
                                                value={role}
                                                onChange={e => setRole(e.target.value)}
                                            />
                                        </motion.div>

                                        <motion.div className="form-field" variants={fadeUp}>
                                            <label className="form-label">Job Description</label>
                                            <textarea
                                                className="form-textarea"
                                                placeholder="Paste the full job description here…"
                                                value={jd}
                                                onChange={e => setJd(e.target.value)}
                                                style={{ minHeight: 200 }}
                                            />
                                        </motion.div>
                                    </motion.div>

                                    <motion.button
                                        className="btn btn-primary"
                                        onClick={handleGenerate}
                                        disabled={loading}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.97 }}
                                    >
                                        {loading ? (
                                            <><div className="spinner" />{loadingMsg || 'Generating…'}</>
                                        ) : (
                                            '✨ Generate Cover Letter'
                                        )}
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 3: Cover Letter */}
                        {step === 3 && (
                            <motion.div key="step3" variants={scaleIn} initial="hidden" animate="show" exit="exit">
                                <div className="card">
                                    <button className="back-btn" onClick={() => setStep(2)}>← Back to Job Details</button>
                                    <h2 className="card-title">✍️ Your Cover Letter</h2>
                                    <p className="card-subtitle">
                                        Generated for <strong className="text-accent">{role}</strong> at <strong className="text-accent">{company}</strong>
                                    </p>

                                    <GapBanner result={gapResult} />

                                    <motion.div
                                        className="letter-box"
                                        ref={letterRef}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.5 }}
                                    >
                                        <Typewriter text={coverLetter} />
                                    </motion.div>

                                    <div className="letter-actions">
                                        <motion.button
                                            className="btn btn-ghost btn-sm"
                                            onClick={handleCopy}
                                            whileHover={{ scale: 1.04 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            📋 Copy
                                        </motion.button>
                                        <motion.button
                                            className="btn btn-ghost btn-sm"
                                            onClick={handleDownload}
                                            whileHover={{ scale: 1.04 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            ⬇️ Download .txt
                                        </motion.button>
                                        <motion.button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => { setStep(2); setCoverLetter(''); setGapResult(null); }}
                                            whileHover={{ scale: 1.04 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            🔄 New Application
                                        </motion.button>
                                    </div>

                                    <div className="divider" />

                                    <h3 style={{ fontSize: '.9rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-2)' }}>
                                        🎨 Refine the Letter
                                    </h3>

                                    <div className="refine-grid">
                                        {refinements.map((r, i) => (
                                            <motion.button
                                                key={i}
                                                className="refine-chip"
                                                onClick={() => handleRefine(r.instruction)}
                                                disabled={loading}
                                                whileHover={{ scale: 1.02, y: -2 }}
                                                whileTap={{ scale: 0.97 }}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.07 }}
                                            >
                                                {r.label}
                                            </motion.button>
                                        ))}
                                    </div>

                                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                                        <input
                                            className="form-input"
                                            placeholder="Custom instruction (e.g. 'Mention my AWS cert')"
                                            value={customInstruction}
                                            onChange={e => setCustomInstruction(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleRefine(customInstruction); }}
                                        />
                                        <motion.button
                                            className="btn btn-primary"
                                            style={{ width: 'auto', flexShrink: 0, padding: '12px 20px' }}
                                            onClick={() => handleRefine(customInstruction)}
                                            disabled={loading || !customInstruction.trim()}
                                            whileHover={{ scale: 1.04 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            {loading ? <div className="spinner" /> : '→'}
                                        </motion.button>
                                    </div>

                                    <AnimatePresence>
                                        {loading && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 10,
                                                    marginTop: 16, color: 'var(--accent-bright)', fontSize: '.85rem', fontWeight: 500
                                                }}
                                            >
                                                <div className="spinner" style={{ borderColor: 'rgba(155,127,255,.4)', borderTopColor: 'var(--accent-bright)' }} />
                                                {loadingMsg}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.footer
                        className="footer"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                    >
                        Built with ✨ Next.js + Gemini 2.5 Flash
                    </motion.footer>
                </div>
            </div>
        </>
    );
}
