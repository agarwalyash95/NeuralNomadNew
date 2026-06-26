import { NextResponse } from 'next/server';

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/planner/:path*',
    '/bookings/:path*',
    '/visa/:path*',
    '/forex/:path*',
    '/travel-pass/:path*',
  ],
};
