import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import Users from './pages/Users';
import Orders from './pages/Orders';
import AuditLogs from './pages/AuditLogs';

function Nav() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="nav">
      <strong>Audit Trails POC</strong>
      <NavLink to="/orders" className={({ isActive }) => isActive ? 'active' : ''}>Orders</NavLink>
      {user.role === 'ADMIN' && (
        <>
          <NavLink to="/users" className={({ isActive }) => isActive ? 'active' : ''}>Users</NavLink>
          <NavLink to="/audit-logs" className={({ isActive }) => isActive ? 'active' : ''}>Audit Logs</NavLink>
        </>
      )}
      <div className="spacer" />
      <span className="muted">{user.email} ({user.role})</span>
      <button className="secondary" onClick={logout}>Logout</button>
    </div>
  );
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/orders" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
        <Route path="/users" element={<RequireAdmin><Users /></RequireAdmin>} />
        <Route path="/audit-logs" element={<RequireAdmin><AuditLogs /></RequireAdmin>} />
        <Route path="*" element={<Navigate to="/orders" replace />} />
      </Routes>
    </>
  );
}
