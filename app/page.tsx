'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Sparkles,
  TrendingUp,
  Wallet,
  Users,
  Bot,
  Shield,
  ArrowRight,
  PieChart,
  Zap,
} from 'lucide-react';

const features = [
  {
    icon: Wallet,
    title: 'Multi-Wallet System',
    description: 'Organize money into logical sections — savings, bills, daily expenses, and custom buckets.',
    gradient: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
  },
  {
    icon: TrendingUp,
    title: 'Smart Analytics',
    description: 'Visualize spending patterns with interactive charts and gain real-time financial insights.',
    gradient: 'linear-gradient(135deg, #00b894, #00cec9)',
  },
  {
    icon: Users,
    title: 'People Management',
    description: 'Track loans, lending, and shared expenses with family, friends, and colleagues.',
    gradient: 'linear-gradient(135deg, #0984e3, #74b9ff)',
  },
  {
    icon: Bot,
    title: 'AI Financial Advisor',
    description: 'Get personalized budget suggestions and expense analysis powered by Gemini AI.',
    gradient: 'linear-gradient(135deg, #fd79a8, #e17055)',
  },
  {
    icon: Shield,
    title: 'Secure Vault',
    description: 'Store sensitive financial data — bank details, cards, and important notes securely.',
    gradient: 'linear-gradient(135deg, #fdcb6e, #e17055)',
  },
  {
    icon: PieChart,
    title: 'Detailed Reports',
    description: 'Monthly summaries, category breakdowns, and exportable financial reports.',
    gradient: 'linear-gradient(135deg, #a29bfe, #6c5ce7)',
  },
];

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* ===== NAVBAR ===== */}
      <nav className="fixed top-0 w-full z-50 border-b border-[var(--border-subtle)]"
        style={{ background: 'rgba(11, 14, 20, 0.8)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Money<span className="gradient-text"> Agent</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm" id="nav-login">
              Sign In
            </Link>
            <Link href="/login?mode=signup" className="btn-primary text-sm px-5 py-2.5 no-underline" id="nav-signup">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(108, 92, 231, 0.3), transparent)' }} />
        <div className="absolute top-40 right-1/4 w-[400px] h-[400px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, rgba(0, 206, 201, 0.3), transparent)' }} />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6"
              style={{ background: 'rgba(108, 92, 231, 0.12)', color: 'var(--accent-primary)', border: '1px solid rgba(108, 92, 231, 0.2)' }}>
              <Zap size={12} />
              Powered by Gemini AI
            </div>
          </motion.div>

          <motion.h1
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <span style={{ color: 'var(--text-primary)' }}>Your Money,</span>
            <br />
            <span className="gradient-text">Intelligently Managed</span>
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            Track expenses, manage multiple wallets, handle loans, and get AI-powered 
            financial insights — all in one beautiful dashboard.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Link href="/login?mode=signup" className="btn-primary text-base px-8 py-3.5 flex items-center gap-2 no-underline" id="hero-cta">
              Start for Free
              <ArrowRight size={18} />
            </Link>
            <Link href="#features" className="btn-secondary text-base px-8 py-3.5 no-underline" id="hero-features">
              Explore Features
            </Link>
          </motion.div>
        </div>

        {/* Dashboard preview mockup */}
        <motion.div
          className="max-w-5xl mx-auto mt-16 relative"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-2xl"
            style={{ background: 'var(--bg-secondary)' }}>
            {/* Mock browser bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-subtle)]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: '#e17055' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#fdcb6e' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#00b894' }} />
              </div>
              <div className="flex-1 mx-4">
                <div className="h-6 rounded-md px-3 flex items-center text-xs"
                  style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}>
                  moneyagent.app/dashboard
                </div>
              </div>
            </div>
            {/* Mock dashboard */}
            <div className="p-6 grid grid-cols-4 gap-4">
              {['Total Balance', 'Income', 'Expenses', 'Savings'].map((label, i) => (
                <div key={label} className="stat-card p-4" style={{ animationDelay: `${i * 100}ms` }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
                  <p className="text-lg font-bold" style={{
                    color: i === 0 ? 'var(--text-primary)' : i === 1 ? 'var(--accent-success)' : i === 2 ? 'var(--accent-danger)' : 'var(--accent-secondary)'
                  }}>
                    {i === 0 ? '₹1,24,500' : i === 1 ? '₹85,000' : i === 2 ? '₹42,300' : '₹42,700'}
                  </p>
                </div>
              ))}
              {/* Mock chart area */}
              <div className="col-span-3 h-40 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <div className="p-4">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Monthly Overview</p>
                  <div className="flex items-end gap-3 mt-4 h-20">
                    {[40, 65, 45, 80, 55, 70, 50, 85, 60, 75, 55, 90].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-sm" style={{
                        height: `${h}%`,
                        background: i % 2 === 0 ? 'var(--accent-primary)' : 'rgba(108, 92, 231, 0.3)',
                        opacity: 0.7 + (i * 0.025),
                      }} />
                    ))}
                  </div>
                </div>
              </div>
              {/* Mock recent transactions */}
              <div className="col-span-1 h-40 rounded-xl p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-tertiary)' }}>Recent</p>
                {['Food', 'Salary', 'Uber'].map((item, i) => (
                  <div key={item} className="flex items-center justify-between py-1.5 text-xs">
                    <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
                    <span style={{ color: i === 1 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                      {i === 1 ? '+₹45K' : i === 0 ? '-₹350' : '-₹180'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Glow beneath */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-20 rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(108, 92, 231, 0.2), transparent)', filter: 'blur(30px)' }} />
        </motion.div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeInUp}
            custom={0}
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Everything You Need to
              <span className="gradient-text"> Master Your Money</span>
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Powerful features designed to give you complete control and clarity over your finances.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="glass-card p-6 group cursor-default"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={fadeInUp}
                custom={i + 1}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: feature.gradient }}
                >
                  <feature.icon size={20} className="text-white" />
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-24 px-6">
        <motion.div
          className="max-w-3xl mx-auto text-center glass-card p-12 relative overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="absolute inset-0 opacity-10"
            style={{ background: 'var(--gradient-primary)' }} />
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Ready to Take Control?
            </h2>
            <p className="text-base mb-8" style={{ color: 'var(--text-secondary)' }}>
              Join thousands of users who trust Money Agent for smarter financial decisions.
            </p>
            <Link href="/login?mode=signup" className="btn-primary text-base px-10 py-4 inline-flex items-center gap-2 no-underline" id="cta-signup">
              Get Started — It&apos;s Free
              <ArrowRight size={18} />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-[var(--border-subtle)] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Money Agent © {new Date().getFullYear()}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Built with Next.js, Firebase & Gemini AI
          </p>
        </div>
      </footer>
    </div>
  );
}
