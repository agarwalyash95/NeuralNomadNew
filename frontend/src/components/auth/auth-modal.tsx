'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, User, Mail, Lock, ArrowRight, X } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/auth.service';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [view, setView] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (view === 'login') {
        const response = await authService.login({
          email,
          password,
        });
        useAuthStore.getState().setTokens(response.tokens);
        useAuthStore.getState().setUser(response.user);
        useAuthStore.getState().setIsAuthenticated(true);
      } else {
        const response = await authService.register({
          email,
          name,
          password, // Removed phone: '' to prevent Django unique constraint/blank errors
        });
        useAuthStore.getState().setTokens(response.tokens);
        useAuthStore.getState().setUser(response.user);
        useAuthStore.getState().setIsAuthenticated(true);
      }

      onClose();
      window.location.reload();
    } catch (error: any) {
      // Logs the exact Django registration error if it fails again
      console.error('Auth Error Payload:', error.response?.data || error);
      alert(view === 'login' ? 'Login failed' : 'Registration failed. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      setIsLoading(true);
      try {
        const response = await authService.googleLogin(codeResponse.access_token);
        useAuthStore.getState().setTokens(response.tokens);
        useAuthStore.getState().setUser(response.user);
        useAuthStore.getState().setIsAuthenticated(true);
        onClose();
        window.location.reload();
      } catch (error) {
        console.error('Google login failed', error);
        const errorMessage = (error as any)?.message || 'Please try again.';
        alert(`Google Sign-In failed: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    },
    onError: (error) => console.log('Google Login Failed:', error),
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="relative h-32 bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                alt="Travel"
                className="h-full w-full object-cover opacity-50"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent" />
              <div className="absolute bottom-4 left-6 flex items-center gap-2 text-slate-900">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg">
                  <Plane className="h-6 w-6" strokeWidth={2.5} />
                </div>
                <span className="text-2xl font-bold tracking-tight">NeuralNomad</span>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="mb-6 flex gap-4 border-b border-slate-100">
                <button
                  onClick={() => setView('login')}
                  className={`pb-3 text-sm font-semibold transition-colors relative ${view === 'login' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Sign In
                  {view === 'login' && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                    />
                  )}
                </button>
                <button
                  onClick={() => setView('register')}
                  className={`pb-3 text-sm font-semibold transition-colors relative ${view === 'register' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Create Account
                  {view === 'register' && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                    />
                  )}
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {view === 'register' && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User size={18} />
                      </div>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <span>Password</span>
                    {view === 'login' && (
                      <a href="#" className="text-blue-600 hover:underline normal-case">
                        Forgot?
                      </a>
                    )}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock size={18} />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-600/20 disabled:opacity-70 transition-all shadow-md shadow-blue-600/20"
                >
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    <>
                      {view === 'login' ? 'Sign In to Account' : 'Create Account'}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <div className="relative my-6 flex items-center py-2">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="mx-4 flex-shrink-0 text-xs font-medium text-slate-400">
                  OR CONTINUE WITH
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button
                onClick={() => loginWithGoogle()}
                type="button"
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </button>

              <p className="mt-6 text-center text-xs text-slate-400">
                By continuing, you agree to our{' '}
                <a href="#" className="underline hover:text-slate-600">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="underline hover:text-slate-600">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
