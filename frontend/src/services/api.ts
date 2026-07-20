/**
 * API client configuration and utilities
 * Handles all HTTP requests to the backend
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { ApiError } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

import { useAuthStore } from '@/store/auth.store';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      // Phase 0c: the backend now assigns anonymous (unauthenticated)
      // planner traffic a per-session identity via the Django session
      // cookie (apps.planner.views.get_planner_user) instead of one shared
      // demo user — without withCredentials the browser never sends/stores
      // that cookie, so every request would look like a brand-new visitor
      // and continuity (the user's own workspace/draft) would break. The
      // backend already allowlists explicit origins + CORS_ALLOW_CREDENTIALS
      // (config/settings/base.py), so this is the only missing piece.
      withCredentials: true,
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use((config) => {
      const token = this.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor - refresh expired access tokens once, then retry
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as (typeof error.config & { _retried?: boolean }) | undefined;

        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest._retried &&
          this.getRefreshToken()
        ) {
          originalRequest._retried = true;
          try {
            const newAccessToken = await this.refreshAccessToken();
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return this.client(originalRequest);
          } catch {
            // Refresh failed — fall through to forced re-auth below
          }
        }

        if (error.response?.status === 401) {
          // Only force login if they were previously authenticated
          if (this.getAccessToken()) {
            this.clearTokens();
            useAuthStore.getState().setAuthModalOpen(true);
            useAuthStore.getState().setUser(null);
            useAuthStore.getState().setIsAuthenticated(false);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Single-flight token refresh — concurrent 401s share one refresh request
  private refreshPromise: Promise<string> | null = null;

  private refreshAccessToken(): Promise<string> {
    if (!this.refreshPromise) {
      this.refreshPromise = axios
        .post<{ access: string }>(`${API_URL}/accounts/auth/token/refresh/`, {
          refresh: this.getRefreshToken(),
        })
        .then((res) => {
          const access = res.data.access;
          if (typeof window !== 'undefined') {
            localStorage.setItem('accessToken', access);
            try {
              const raw = localStorage.getItem('neuralnomad-auth');
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.state) {
                  if (!parsed.state.tokens) parsed.state.tokens = {};
                  parsed.state.tokens.access = access;
                  localStorage.setItem('neuralnomad-auth', JSON.stringify(parsed));
                }
              }
            } catch {}
          }
          return access;
        })
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  }

  // Authentication Methods
  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('neuralnomad-auth');
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: { tokens?: { access?: string } } };
        return parsed?.state?.tokens?.access ?? null;
      }
    } catch {}
    return localStorage.getItem('accessToken');
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('neuralnomad-auth');
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: { tokens?: { refresh?: string } } };
        return parsed?.state?.tokens?.refresh ?? null;
      }
    } catch {}
    return localStorage.getItem('refreshToken');
  }

  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  clearTokens(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  // Generic request methods
  async get<T>(url: string, config = {}): Promise<T> {
    try {
      const response = await this.client.get<T>(url, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async post<T>(url: string, data?: any, config = {}): Promise<T> {
    try {
      const response = await this.client.post<T>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async put<T>(url: string, data?: any, config = {}): Promise<T> {
    try {
      const response = await this.client.put<T>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async patch<T>(url: string, data?: any, config = {}): Promise<T> {
    try {
      const response = await this.client.patch<T>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async delete<T>(url: string, config = {}): Promise<T> {
    try {
      const response = await this.client.delete<T>(url, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Error handling
  private handleError(error: any): ApiError {
    if (error.response) {
      // Server responded with error status
      return {
        message:
          error.response.data?.detail ||
          error.response.data?.message ||
          error.response.data?.error ||
          'An error occurred',
        status: error.response.status,
        code: error.response.data?.code || 'UNKNOWN_ERROR',
        data: error.response.data,
      };
    } else if (error.request) {
      // Request made but no response
      return {
        message: 'No response from server',
        status: 0,
        code: 'NO_RESPONSE',
      };
    } else {
      // Error in request setup
      return {
        message: error.message || 'An unknown error occurred',
        status: 0,
        code: 'REQUEST_ERROR',
      };
    }
  }
}

export const apiClient = new ApiClient();
