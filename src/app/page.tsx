import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirección automática del lado del servidor (HTTP 307)
  redirect('/auth/login');
}