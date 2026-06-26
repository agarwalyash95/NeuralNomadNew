'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { userService } from '@/services/user.service';
import { Camera, Mail, Phone, MapPin, PlaneTakeoff, Loader2, Save, BadgeAlert, CheckCircle2 } from 'lucide-react';

export default function ProfileSettingsPage() {
  const { user, setUser } = useAuthStore();
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    home_city: '',
    home_airport: '',
    preferred_currency: 'USD',
  });
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        home_city: user.home_city || '',
        home_airport: user.home_airport || '',
        preferred_currency: user.preferred_currency || 'USD',
      });
      if (user.avatar) {
        setAvatarPreview(user.avatar.startsWith('http') ? user.avatar : `http://localhost:8000${user.avatar}`);
      }
    }
  }, [user]);

  if (!user) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const fd = new FormData();
      Object.entries(formData).forEach(([key, val]) => {
        fd.append(key, val);
      });
      if (avatarFile) {
        fd.append('avatar', avatarFile);
      }

      const updatedUser = await userService.updateProfile(fd);
      setUser(updatedUser);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500";
  const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-500";

  return (
    <div className="max-w-3xl">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-slate-900">Personal Information</h2>
        <p className="mb-6 text-sm text-slate-500">Update your profile details and preferences.</p>

        <form onSubmit={handleSubmit}>
          {/* Avatar Section */}
          <div className="mb-8 flex items-center gap-6">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-slate-50 bg-slate-100 shadow-sm">
              <img
                src={avatarPreview || `https://api.dicebear.com/7.x/notionists/svg?seed=${user.email}&backgroundColor=e2e8f0`}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100"
              >
                <Camera className="text-white" size={24} />
              </button>
            </div>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
              >
                Change Avatar
              </button>
              <p className="mt-2 text-xs text-slate-500">JPG, GIF or PNG. Max size of 800K</p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Name */}
            <div>
              <label className={labelCls}>Full Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputCls}
              />
            </div>

            {/* Email (Read Only) */}
            <div>
              <label className={labelCls}>Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  readOnly
                  value={user.email}
                  className="mt-1 block w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 pl-10 text-sm text-slate-500 opacity-70"
                />
                <Mail size={16} className="absolute left-3.5 top-4 text-slate-400" />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className={labelCls}>Phone Number</label>
              <div className="relative">
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className={`${inputCls} pl-10`}
                />
                <Phone size={16} className="absolute left-3.5 top-4 text-slate-400" />
              </div>
              <p className="mt-1.5 text-[10px] text-amber-600 flex items-center gap-1">
                <BadgeAlert size={12} /> Changing phone number requires re-verification.
              </p>
            </div>

            {/* Preferred Currency */}
            <div>
              <label className={labelCls}>Preferred Currency</label>
              <select
                value={formData.preferred_currency}
                onChange={(e) => setFormData({ ...formData, preferred_currency: e.target.value })}
                className={inputCls}
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="INR">INR - Indian Rupee</option>
                <option value="AED">AED - UAE Dirham</option>
                <option value="SGD">SGD - Singapore Dollar</option>
                <option value="MYR">MYR - Malaysian Ringgit</option>
              </select>
            </div>

            {/* Home City */}
            <div>
              <label className={labelCls}>Home City</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.home_city}
                  onChange={(e) => setFormData({ ...formData, home_city: e.target.value })}
                  placeholder="e.g. New York"
                  className={`${inputCls} pl-10`}
                />
                <MapPin size={16} className="absolute left-3.5 top-4 text-slate-400" />
              </div>
            </div>

            {/* Home Airport */}
            <div>
              <label className={labelCls}>Home Airport Code</label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={3}
                  value={formData.home_airport}
                  onChange={(e) => setFormData({ ...formData, home_airport: e.target.value.toUpperCase() })}
                  placeholder="e.g. JFK"
                  className={`${inputCls} pl-10 uppercase`}
                />
                <PlaneTakeoff size={16} className="absolute left-3.5 top-4 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
            <div className="flex items-center gap-2">
              {error && <span className="text-sm font-medium text-red-500">{error}</span>}
              {success && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                  <CheckCircle2 size={16} /> Profile updated
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-70"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
