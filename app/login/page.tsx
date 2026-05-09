'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Sparkles, Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';

function LoginForm() {
  const searchParams = useSearchParams();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, signIn, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get('mode') === 'signup') setIsSignup(true);
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignup) await signUp(email, password, name);
      else await signIn(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      if (msg.includes('email-already-in-use')) setError('Email already registered.');
      else if (msg.includes('invalid-credential')) setError('Invalid email or password.');
      else if (msg.includes('weak-password')) setError('Password must be 6+ characters.');
      else setError(msg);
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(''); setLoading(true);
    try { 
      await signInWithGoogle(); 
      router.push('/dashboard');
    }
    catch { 
      setError('Google sign-in failed.'); 
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] relative z-10 animate-fade-in-up">
      <Link href="/" className="flex items-center justify-center gap-2.5 mb-8 no-underline">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
          <Sparkles size={20} className="text-white" />
        </div>
        <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Money<span className="gradient-text">AI</span></span>
      </Link>

      <div className="rounded-2xl p-8 border border-[var(--border-subtle)]" style={{ background: 'var(--bg-secondary)' }}>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{isSignup ? 'Start managing finances smarter' : 'Sign in to your dashboard'}</p>
        </div>

        <button onClick={handleGoogle} disabled={loading} className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium transition-all mb-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} id="google-signin-btn">
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>or</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="input-field pl-11" required={isSignup} id="input-name" />
            </div>
          )}
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="input-field pl-11" required id="input-email" />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="input-field pl-11 pr-11" required minLength={6} id="input-password" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} id="toggle-password">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'rgba(225,112,85,0.1)', color: 'var(--accent-danger)' }}>{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2" id="submit-btn">
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{isSignup ? 'Create Account' : 'Sign In'}<ArrowRight size={16} /></>}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--text-secondary)' }}>
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => { setIsSignup(!isSignup); setError(''); }} className="font-medium hover:underline" style={{ color: 'var(--accent-primary)' }} id="toggle-auth-mode">
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full opacity-10" style={{ background: 'radial-gradient(circle, rgba(108,92,231,0.4), transparent)' }} />
      <Suspense fallback={<div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
