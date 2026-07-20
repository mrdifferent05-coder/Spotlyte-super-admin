import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default function Home() {
  const authed = cookies().has('spotlyte_admin');
  redirect(authed ? '/overview' : '/login');
}
