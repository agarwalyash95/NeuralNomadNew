'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, Search, Bell, Menu, X, Briefcase } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import AuthModal from '@/components/auth/auth-modal';
import { authService } from '@/services/auth.service';
import { notificationService } from '@/services/notification.service';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';

const navItems = [
  { href: '/planner', label: 'AI Planner' },
  { href: '/bookings', label: 'Search Travel' },
  { href: '/attractions', label: 'Explore' },
  { href: '/travel-prep', label: 'Travel Prep' },
];
const handleLogout = async () => {
  try {
    const refresh = localStorage.getItem('refreshToken');
    if (refresh) {
      await authService.logout(refresh);
    }
  } catch (error) {
    console.error('Logout process error:', error);
  } finally {
    useAuthStore.getState().reset();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/';
  }
};

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isAuthModalOpen = useAuthStore((state) => state.isAuthModalOpen);
  const setAuthModalOpen = useAuthStore((state) => state.setAuthModalOpen);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileMenuOpen(false);
    setIsNotificationOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isAuthenticated) {
      notificationService.unreadCount().then(res => {
        setUnreadCount((res as any)?.unread_count || 0);
      }).catch(() => {
        // Silently ignore if unread count fails
      });
    }
  }, [isAuthenticated, isNotificationOpen]);

  return (
    <>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setAuthModalOpen(false)} />

      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out ${
          isScrolled
            ? 'bg-white/80 backdrop-blur-lg border-b border-slate-200/50 shadow-sm py-2'
            : 'bg-transparent py-3'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 cursor-pointer group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 group-hover:bg-blue-700 transition-colors">
              <Plane className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <span
              className={`text-xl font-bold tracking-tight transition-colors ${isScrolled ? 'text-slate-900' : 'text-slate-900'}`}
            >
              NeuralNomad
            </span>
          </Link>

          <nav className="hidden lg:flex items-center space-x-1 rounded-full bg-slate-100/50 p-1 backdrop-blur-md border border-slate-200/50">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-nav-pill"
                      className="absolute inset-0 z-[-1] rounded-full bg-blue-600 shadow-md shadow-blue-600/20"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="hidden lg:flex items-center gap-4">
            <div className="flex items-center gap-1 rounded-full bg-slate-100/50 p-1 backdrop-blur-md border border-slate-200/50">
              <button className="rounded-full p-2 text-slate-500 hover:bg-white hover:text-slate-900 transition-all shadow-sm">
                <Search size={18} />
              </button>
              <div className="relative">
                <button 
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="relative rounded-full p-2 text-slate-500 hover:bg-white hover:text-slate-900 transition-all shadow-sm"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-2 ring-slate-100">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {isNotificationOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsNotificationOpen(false)} />
                      <NotificationDropdown onClose={() => setIsNotificationOpen(false)} />
                    </>
                  )}
                </AnimatePresence>
              </div>
              {isAuthenticated && (
                <Link
                  href="/vault/bookings"
                  className="rounded-full p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm"
                  title="My Vault"
                >
                  <Briefcase size={18} />
                </Link>
              )}
            </div>

            {isAuthenticated && user ? (
              <div className="relative pl-2 border-l border-slate-200">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 rounded-full hover:bg-slate-50 transition-colors p-1 pr-3"
                >
                  <div className="h-9 w-9 rounded-full bg-slate-200 border border-slate-300 shadow-sm overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={user.avatar ? (user.avatar.startsWith('http') ? user.avatar : `http://localhost:8000${user.avatar}`) : `https://api.dicebear.com/7.x/notionists/svg?seed=${user.email}&backgroundColor=e2e8f0`}
                      alt="Avatar"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold text-slate-900 leading-tight">
                      {user.name || user.email.split('@')[0]}
                    </span>
                  </div>
                </button>

                <AnimatePresence>
                  {isProfileMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white p-2 shadow-xl border border-slate-100 z-50"
                      >
                        <div className="px-3 py-2 border-b border-slate-100 mb-2">
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                        <Link
                          href="/settings/profile"
                          className="block w-full text-left rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                        >
                          Settings
                        </Link>
                        <button
                          onClick={async () => {
                            setIsProfileMenuOpen(false);
                            await handleLogout();
                          }}
                          className="block w-full text-left rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Logout
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors shadow-lg"
              >
                Sign In
              </button>
            )}
          </div>

          <div className="lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-600 bg-slate-100 rounded-full"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-white/95 backdrop-blur-xl pt-24 px-6 lg:hidden"
          >
            <div className="flex flex-col gap-6">
              {isAuthenticated && user ? (
                <div className="flex items-center gap-4 pb-6 border-b border-slate-200">
                  <div className="h-14 w-14 rounded-full bg-slate-200 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user.email}&backgroundColor=e2e8f0`}
                      alt="Avatar"
                    />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-lg">
                      {user.name || user.email.split('@')[0]}
                    </div>
                    <button
                      onClick={async () => {
                        setIsMobileMenuOpen(false);
                        await handleLogout();
                      }}
                      className="text-sm text-red-500 hover:underline"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pb-6 border-b border-slate-200">
                  <button
                    onClick={() => {
                      setAuthModalOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
                  >
                    Sign In
                  </button>
                </div>
              )}

              <nav className="flex flex-col gap-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between rounded-xl px-4 py-4 text-left font-medium transition-all ${
                        isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                      {isActive && <Plane className="h-5 w-5 text-blue-600" />}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto pb-10 flex gap-4 justify-center">
                <button className="flex flex-col items-center gap-2 text-slate-500">
                  <div className="p-3 bg-slate-100 rounded-full">
                    <Search size={20} />
                  </div>
                  <span className="text-xs">Search</span>
                </button>
                {isAuthenticated && (
                  <Link
                    href="/vault/bookings"
                    className="flex flex-col items-center gap-2 text-slate-500"
                  >
                    <div className="p-3 bg-slate-100 rounded-full">
                      <Briefcase size={20} />
                    </div>
                    <span className="text-xs">Vault</span>
                  </Link>
                )}
                <Link 
                  href="/notifications"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex flex-col items-center gap-2 text-slate-500 relative"
                >
                  <div className="p-3 bg-slate-100 rounded-full relative">
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-slate-100" />
                    )}
                  </div>
                  <span className="text-xs">Alerts</span>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
