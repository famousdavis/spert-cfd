import Link from 'next/link';
import { APP_VERSION } from '@/lib/constants';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 py-3 text-center text-xs text-gray-500">
      &copy; {new Date().getFullYear()} William W. Davis, MSPM, PMP |{' '}
      <Link
        href="/changelog"
        className="text-blue-600 hover:text-blue-700"
      >
        Version {APP_VERSION}
      </Link>{' '}
      | Licensed under GNU GPL v3
    </footer>
  );
}
