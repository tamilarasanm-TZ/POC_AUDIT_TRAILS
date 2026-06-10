import { useEffect, useState } from 'react';
import { api } from '../api';

type User = { id: string; email: string; name: string; role: 'ADMIN' | 'USER' };

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'USER' as 'ADMIN' | 'USER' });
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await api.get<User[]>('/users');
    setUsers(r.data);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post('/users', form);
      setForm({ email: '', password: '', name: '', role: 'USER' });
      await load();
    } catch (e: any) {
      setErr(e.response?.data?.message ?? 'Create failed');
    }
  }

  async function changeRole(u: User, role: 'ADMIN' | 'USER') {
    await api.patch(`/users/${u.id}`, { role });
    await load();
  }
  async function remove(u: User) {
    if (!confirm(`Delete ${u.email}?`)) return;
    await api.delete(`/users/${u.id}`);
    await load();
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Create user</h2>
        <form onSubmit={create} className="row">
          <input placeholder="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })}>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button>Create</button>
          {err && <span className="error">{err}</span>}
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Users</h2>
        <table>
          <thead><tr><th>Email</th><th>Name</th><th>Role</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name}</td>
                <td>
                  <select value={u.role} onChange={(e) => changeRole(u, e.target.value as any)}>
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td><button className="danger" onClick={() => remove(u)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
