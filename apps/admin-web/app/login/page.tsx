'use client';

// Login — centered card on --wash, brand lockup, error shake.
// Seed admin: priya@spotlyte.in / admin123
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { LOGIN } from '@/lib/gql';
import { Icon } from '@/components/ui/Icon';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('priya@spotlyte.in');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [login, { loading }] = useMutation(LOGIN);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const { data } = await login({ variables: { email, password } });
      const res = data?.adminLoginV2;
      if (res?.success) {
        window.location.href = '/overview';
      } else {
        setErr(res?.message || 'Invalid email or password');
        setShake(true);
        setTimeout(() => setShake(false), 450);
      }
    } catch {
      setErr('Could not reach the API. Is it running on :4000?');
      setShake(true);
      setTimeout(() => setShake(false), 450);
    }
  };

  return (
    <div className="login-wrap">
      <div className={'login-card' + (shake ? ' shake' : '')}>
        <div className="row gap8" style={{ alignItems: 'baseline', marginBottom: 6 }}>
          <span className="brand-word" style={{ fontSize: 26 }}>spotlyte.</span>
          <span className="brand-tag">admin</span>
        </div>
        <div className="muted" style={{ fontSize: 13.5, marginBottom: 26 }}>
          Super Admin Console — internal access only.
        </div>
        {err && <div className="login-err">{err}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@spotlyte.in"
              autoComplete="username"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              autoFocus
              required
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            <Icon name="shield" size={16} />
            {loading ? 'Signing in…' : 'Sign in to console'}
          </button>
        </form>
        <div className="muted mono" style={{ fontSize: 11, marginTop: 20, textAlign: 'center' }}>
          seed login · priya@spotlyte.in / admin123
        </div>
      </div>
    </div>
  );
}
