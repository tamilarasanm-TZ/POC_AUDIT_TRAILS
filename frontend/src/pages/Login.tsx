import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await login(email, password);
      nav('/orders');
    } catch (e: any) {
      setErr(e.response?.data?.message ?? 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={onSubmit}>
        <h2 style={{ marginTop: 0 }}>Sign in</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
          {err && <div className="error">{err}</div>}
          <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <div className="muted" style={{ fontSize: 12 }}>
            Seeded: admin@example.com / admin123 · user@example.com / user123
          </div>
        </div>
      </form>
    </div>
  );
}
