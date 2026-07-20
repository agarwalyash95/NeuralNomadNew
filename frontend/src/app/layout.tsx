import './globals.css';
import Navbar from '@/components/layout/navbar';
import AuthProvider from '@/providers/auth-provider';
import QueryProvider from '@/providers/query-provider';
import { GoogleOAuthProvider } from '@react-oauth/google';

export const metadata = {
  title: 'NeuralNomad | Travel Platform',
  description: 'Design your perfect trip with ease.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const googleClientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    '504846204351-i9faae4vu66s09f19e2h3sgtsas73mi6.apps.googleusercontent.com';

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-slate-200 font-sans">
        <GoogleOAuthProvider clientId={googleClientId}>
          <QueryProvider>
            <AuthProvider>
              <Navbar />

              <main className="min-h-screen pt-16">{children}</main>
            </AuthProvider>
          </QueryProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
