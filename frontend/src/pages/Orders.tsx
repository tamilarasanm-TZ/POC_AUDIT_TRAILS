import { useEffect, useState } from 'react';
import { api } from '../api';

type Order = {
  id: string;
  userId: string;
  product: string;
  quantity: number;
  amount: number;
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  user?: { email: string; name: string };
};

const STATUSES: Order['status'][] = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState({ product: '', quantity: 1, amount: 0 });

  async function load() {
    const r = await api.get<Order[]>('/orders');
    setOrders(r.data);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/orders', form);
    setForm({ product: '', quantity: 1, amount: 0 });
    await load();
  }
  async function changeStatus(o: Order, status: Order['status']) {
    await api.patch(`/orders/${o.id}`, { status });
    await load();
  }
  async function remove(o: Order) {
    if (!confirm(`Delete order ${o.product}?`)) return;
    await api.delete(`/orders/${o.id}`);
    await load();
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>New order</h2>
        <form onSubmit={create} className="row">
          <input placeholder="product" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
          <input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          <input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          <button>Create</button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Orders</h2>
        <table>
          <thead><tr><th>Product</th><th>Qty</th><th>Amount</th><th>Status</th><th>User</th><th /></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.product}</td>
                <td>{o.quantity}</td>
                <td>${o.amount.toFixed(2)}</td>
                <td>
                  <select value={o.status} onChange={(e) => changeStatus(o, e.target.value as any)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>{o.user?.email ?? '-'}</td>
                <td><button className="danger" onClick={() => remove(o)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
