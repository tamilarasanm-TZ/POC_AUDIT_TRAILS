import { useEffect, useState } from 'react';
import { api } from '../api';

type AuditLog = {
  id: string;
  timestamp: string;
  userEmail: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  before: any;
  after: any;
  metadata: any;
  ipAddress: string | null;
  userAgent: string | null;
  httpMethod: string | null;
  url: string | null;
  statusCode: number | null;
  prevHash: string | null;
  hash: string;
};

function badgeClass(action: string) {
  const a = action.toLowerCase();
  if (a.includes('create')) return 'badge create';
  if (a.includes('update')) return 'badge update';
  if (a.includes('delete')) return 'badge delete';
  if (a.includes('login_success')) return 'badge login_success';
  if (a.includes('login_failure')) return 'badge login_failure';
  if (a.includes('logout')) return 'badge logout';
  if (a.includes('register')) return 'badge register';
  if (a.includes('permission')) return 'badge permission_change';
  return 'badge';
}

export default function AuditLogs() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filters, setFilters] = useState({ action: '', entity: '', q: '', from: '', to: '' });
  const [verify, setVerify] = useState<{ ok: boolean; total: number; brokenAtId?: string } | null>(null);

  async function load() {
    const params: any = { page, pageSize };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    const r = await api.get('/audit-logs', { params });
    setItems(r.data.items);
    setTotal(r.data.total);
  }
  useEffect(() => { load(); }, [page]);

  async function runVerify() {
    const r = await api.get('/audit-logs/verify');
    setVerify(r.data);
  }

  function exportCsv() {
    const token = localStorage.getItem('token');
    fetch('/api/audit-logs/export.csv', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((b) => {
        const url = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = url; a.download = 'audit-logs.csv'; a.click();
        URL.revokeObjectURL(url);
      });
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Audit Logs</h2>
        <div className="row">
          <input placeholder="search (email/url/action)" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <input placeholder="action" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} />
          <input placeholder="entity" value={filters.entity} onChange={(e) => setFilters({ ...filters, entity: e.target.value })} />
          <input type="datetime-local" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <input type="datetime-local" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          <button onClick={() => { setPage(1); load(); }}>Apply</button>
          <button className="secondary" onClick={exportCsv}>Export CSV</button>
          <button className="secondary" onClick={runVerify}>Verify chain</button>
          {verify && (
            <span className={verify.ok ? 'ok' : 'error'}>
              {verify.ok ? `OK — ${verify.total} rows` : `BROKEN at id=${verify.brokenAtId}`}
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Method / URL</th>
              <th>IP</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.timestamp).toLocaleString()}</td>
                <td>{r.userEmail ?? '-'}</td>
                <td><span className={badgeClass(r.action)}>{r.action}</span></td>
                <td>{r.entity}{r.entityId ? ` #${r.entityId.slice(0, 8)}` : ''}</td>
                <td>{r.httpMethod} {r.url}</td>
                <td>{r.ipAddress ?? '-'}</td>
                <td>{r.statusCode ?? '-'}</td>
                <td>
                  <details>
                    <summary>view</summary>
                    {r.before && <><div className="muted">before</div><pre className="diff">{JSON.stringify(r.before, null, 2)}</pre></>}
                    {r.after && <><div className="muted">after</div><pre className="diff">{JSON.stringify(r.after, null, 2)}</pre></>}
                    {r.metadata && <><div className="muted">metadata</div><pre className="diff">{JSON.stringify(r.metadata, null, 2)}</pre></>}
                    <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                      hash: {r.hash.slice(0, 16)}… · prev: {r.prevHash?.slice(0, 16) ?? '-'}
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="muted">Page {page} / {pages} · {total} total</span>
          <button className="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
