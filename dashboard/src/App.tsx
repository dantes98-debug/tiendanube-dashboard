import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import ConnectScreen from "./ConnectScreen";
import { getCredentials, clearCredentials, apiFetch, type Credentials } from "./api";

const REFRESH_INTERVAL = 60_000;

interface Metrics {
  today: { revenue: number; orders: number; currency: string };
  thisWeek: { revenue: number; orders: number };
  thisMonth: { revenue: number; orders: number };
  dailySales: { date: string; revenue: number; orders: number }[];
}
interface Order {
  id: number; number: number; status: string; payment_status: string;
  total: string; currency: string; created_at: string;
  customer: { name: string; email: string } | null;
  products: { name: string; quantity: number; price: string }[];
}
interface Product {
  id: number; name: { es: string }; stock: number | null; price: string;
}

type Tab = "rentabilidad" | "ordenes" | "productos" | "cashflow";

const COST_RATIO = 0.42;
const COMMISSION = 0.04;
const SHIPPING_AVG = 1800;

function fmt(n: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) +
    " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function Badge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    open: ["#1d4ed8", "#bfdbfe"], closed: ["#14532d", "#bbf7d0"],
    cancelled: ["#7f1d1d", "#fecaca"], paid: ["#14532d", "#bbf7d0"],
    pending: ["#78350f", "#fde68a"], abandoned: ["#1e293b", "#94a3b8"],
  };
  const [bg, color] = map[status] ?? ["#1e293b", "#94a3b8"];
  return <span style={{ background: bg, color, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{status}</span>;
}

function KPI({ label, value, sub, trend, accent = "#a78bfa" }: {
  label: string; value: string; sub?: string; trend?: number; accent?: string;
}) {
  return (
    <div style={s.kpi}>
      <div style={{ ...s.kpiAccent, background: accent }} />
      <div style={s.kpiLabel}>{label}</div>
      <div style={s.kpiValue}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        {trend !== undefined && (
          <span style={{ color: trend >= 0 ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 600 }}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {sub && <span style={s.kpiSub}>{sub}</span>}
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...s.navItem, ...(active ? s.navActive : {}) }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default function App() {
  const [creds, setCreds] = useState<Credentials | null>(getCredentials);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [tab, setTab] = useState<Tab>("rentabilidad");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!creds) return;
    try {
      const [m, o, p, ls] = await Promise.all([
        apiFetch<Metrics>("/metrics", creds),
        apiFetch<Order[]>("/orders?limit=20", creds),
        apiFetch<Product[]>("/products", creds),
        apiFetch<Product[]>("/low-stock?threshold=10", creds),
      ]);
      setMetrics(m); setOrders(o); setProducts(p); setLowStock(ls);
      setLastUpdate(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [creds]);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [fetchAll]);

  function handleDisconnect() {
    clearCredentials();
    setCreds(null);
    setMetrics(null);
    setOrders([]);
    setProducts([]);
    setLowStock([]);
    setLoading(true);
  }

  if (!creds) return <ConnectScreen onConnect={() => setCreds(getCredentials())} />;

  const isDemo = creds.storeId === "demo";
  const monthRevenue = metrics?.thisMonth.revenue ?? 0;
  const monthOrders  = metrics?.thisMonth.orders ?? 0;
  const monthCosts   = monthRevenue * COST_RATIO;
  const monthComm    = monthRevenue * COMMISSION;
  const monthShip    = monthOrders * SHIPPING_AVG;
  const monthGross   = monthRevenue - monthCosts - monthComm - monthShip;
  const marginPct    = monthRevenue > 0 ? (monthGross / monthRevenue) * 100 : 0;
  const ticketAvg    = monthOrders > 0 ? monthRevenue / monthOrders : 0;

  const chartData = metrics?.dailySales.slice(-14).map(d => ({
    ...d, date: fmtDate(d.date), revenue: Math.round(d.revenue),
    ganancia: Math.round(d.revenue * (1 - COST_RATIO - COMMISSION) - SHIPPING_AVG),
  })) ?? [];

  const cashflowData = [
    { name: "Mercado Pago",     pct: 55, dias: 2,  color: "#6366f1" },
    { name: "Tarjeta crédito",  pct: 25, dias: 30, color: "#f59e0b" },
    { name: "Transferencia",    pct: 15, dias: 1,  color: "#22c55e" },
    { name: "Otro",             pct: 5,  dias: 7,  color: "#94a3b8" },
  ].map(m => ({ ...m, monto: (monthRevenue * m.pct) / 100 }));

  const ordersByStatus = [
    { name: "Pagadas",    value: orders.filter(o => o.payment_status === "paid").length,   color: "#22c55e" },
    { name: "Pendientes", value: orders.filter(o => o.payment_status === "pending").length, color: "#f59e0b" },
    { name: "Canceladas", value: orders.filter(o => o.status === "cancelled").length,       color: "#ef4444" },
  ];

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0c0a0d", color: "#e2e8f0", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 40, height: 40, border: "3px solid #2a1f2e", borderTop: "3px solid #a78bfa", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <p style={{ color: "#6b7280" }}>Cargando tu tienda...</p>
    </div>
  );

  return (
    <div style={s.layout}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0c0a0d; }
        ::-webkit-scrollbar-thumb { background: #2a1f2e; border-radius: 4px; }
        button { cursor: pointer; }
        input:focus { border-color: #6366f1 !important; }
      `}</style>

      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <div style={s.logoDot} />
          <span style={s.logoText}>{isDemo ? "Demo" : `Store ${creds.storeId}`}</span>
        </div>
        <nav style={s.nav}>
          <NavItem icon="📊" label="Rentabilidad" active={tab === "rentabilidad"} onClick={() => setTab("rentabilidad")} />
          <NavItem icon="📦" label="Órdenes"      active={tab === "ordenes"}      onClick={() => setTab("ordenes")} />
          <NavItem icon="🛍️" label="Productos"    active={tab === "productos"}    onClick={() => setTab("productos")} />
          <NavItem icon="💸" label="Cashflow"      active={tab === "cashflow"}     onClick={() => setTab("cashflow")} />
        </nav>

        {lowStock.length > 0 && (
          <div style={s.alert}>
            <div style={s.alertDot} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#fbbf24" }}>Stock crítico</div>
              <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>{lowStock.length} productos bajos</div>
            </div>
          </div>
        )}

        <div style={s.sidebarFooter}>
          {isDemo && <div style={{ fontSize: 10, color: "#f59e0b", marginBottom: 4 }}>⚠ Modo demo</div>}
          <div style={{ fontSize: 10, color: "#4b5563" }}>
            {lastUpdate ? `↺ ${lastUpdate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </div>
          <button onClick={handleDisconnect} style={s.disconnectBtn}>Desconectar</button>
        </div>
      </aside>

      {/* Main */}
      <main style={s.main}>

        {tab === "rentabilidad" && (
          <>
            <div style={s.pageHeader}>
              <h1 style={s.pageTitle}>Dashboard de Rentabilidad</h1>
              <span style={s.pageTag}>Este mes · {isDemo ? "datos demo" : "datos reales"}</span>
            </div>
            <div style={s.kpiGrid}>
              <KPI label="Ingresos del mes" value={fmt(monthRevenue)} sub={`${monthOrders} órdenes`} accent="#6366f1" trend={8.2} />
              <KPI label="Ganancia neta" value={fmt(monthGross)} sub={`${marginPct.toFixed(1)}% de margen`} accent="#22c55e" trend={marginPct > 20 ? 2.1 : -3.4} />
              <KPI label="Ticket promedio" value={fmt(ticketAvg)} sub="por orden" accent="#f59e0b" />
              <KPI label="Costos totales" value={fmt(monthCosts + monthComm + monthShip)} sub="prod + envío + comisión" accent="#ef4444" />
            </div>
            <div style={s.twoCol}>
              <div style={s.card}>
                <h3 style={s.cardTitle}>Ingresos vs Ganancia — 14 días</h3>
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gGain" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1520" />
                    <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={fmtShort} />
                    <Tooltip contentStyle={{ background: "#16131a", border: "1px solid #2a1f2e", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number, name: string) => [fmt(v), name === "revenue" ? "Ingresos" : "Ganancia"]} />
                    <Area type="monotone" dataKey="revenue"  stroke="#6366f1" fill="url(#gRev)"  strokeWidth={2} />
                    <Area type="monotone" dataKey="ganancia" stroke="#22c55e" fill="url(#gGain)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={s.card}>
                <h3 style={s.cardTitle}>Distribución de costos</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
                  {[
                    { label: "Costo de producto",   value: monthCosts, color: "#6366f1", pct: COST_RATIO * 100 },
                    { label: "Comisión Tiendanube",  value: monthComm,  color: "#f59e0b", pct: COMMISSION * 100 },
                    { label: "Envíos",               value: monthShip,  color: "#94a3b8", pct: (monthRevenue > 0 ? (monthShip / monthRevenue) * 100 : 0) },
                    { label: "Ganancia neta",        value: monthGross, color: "#22c55e", pct: marginPct },
                  ].map(row => (
                    <div key={row.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>{row.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: row.color }}>{fmt(row.value)} ({row.pct.toFixed(1)}%)</span>
                      </div>
                      <div style={{ height: 5, background: "#1a1520", borderRadius: 4 }}>
                        <div style={{ width: `${Math.min(Math.max(row.pct, 0), 100)}%`, height: "100%", background: row.color, borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={s.card}>
              <h3 style={s.cardTitle}>Órdenes recientes</h3>
              <table style={s.table}>
                <thead><tr>{["#", "Cliente", "Total", "Ganancia est.", "Estado", "Pago", "Fecha"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {orders.slice(0, 8).map(o => {
                    const total = parseFloat(o.total);
                    const ganancia = total * (1 - COST_RATIO - COMMISSION) - SHIPPING_AVG;
                    return (
                      <tr key={o.id} style={s.tr}>
                        <td style={s.td}>#{o.number}</td>
                        <td style={s.td}>{o.customer?.name ?? "—"}</td>
                        <td style={{ ...s.td, fontWeight: 600 }}>{fmt(total)}</td>
                        <td style={{ ...s.td, color: ganancia > 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{fmt(ganancia)}</td>
                        <td style={s.td}><Badge status={o.status} /></td>
                        <td style={s.td}><Badge status={o.payment_status} /></td>
                        <td style={{ ...s.td, color: "#6b7280" }}>{fmtDateTime(o.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "ordenes" && (
          <>
            <div style={s.pageHeader}>
              <h1 style={s.pageTitle}>Órdenes</h1>
              <span style={s.pageTag}>{orders.length} en total</span>
            </div>
            <div style={s.twoCol}>
              <div style={s.card}>
                <h3 style={s.cardTitle}>Órdenes por día — 14 días</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1520" />
                    <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#16131a", border: "1px solid #2a1f2e", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="orders" fill="#6366f1" radius={[4, 4, 0, 0]} name="Órdenes" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={s.card}>
                <h3 style={s.cardTitle}>Estado de órdenes</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <PieChart width={130} height={130}>
                    <Pie data={ordersByStatus} cx={60} cy={60} innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                      {ordersByStatus.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {ordersByStatus.map(e => (
                      <div key={e.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: e.color }} />
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>{e.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{e.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={s.card}>
              <table style={s.table}>
                <thead><tr>{["#", "Cliente", "Email", "Total", "Productos", "Estado", "Pago", "Fecha"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} style={s.tr}>
                      <td style={s.td}>#{o.number}</td>
                      <td style={s.td}>{o.customer?.name ?? "—"}</td>
                      <td style={{ ...s.td, color: "#6b7280", fontSize: 11 }}>{o.customer?.email ?? "—"}</td>
                      <td style={{ ...s.td, fontWeight: 600, color: "#a78bfa" }}>{fmt(parseFloat(o.total))}</td>
                      <td style={{ ...s.td, color: "#6b7280", fontSize: 11 }}>{o.products?.map(p => p.name).join(", ") ?? "—"}</td>
                      <td style={s.td}><Badge status={o.status} /></td>
                      <td style={s.td}><Badge status={o.payment_status} /></td>
                      <td style={{ ...s.td, color: "#6b7280" }}>{fmtDateTime(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "productos" && (
          <>
            <div style={s.pageHeader}>
              <h1 style={s.pageTitle}>Productos</h1>
              <span style={s.pageTag}>{products.length} productos · {lowStock.length} con stock bajo</span>
            </div>
            {lowStock.length > 0 && (
              <div style={s.alertBanner}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <strong>{lowStock.length} productos con stock ≤ 10:</strong>
                <span style={{ color: "#fbbf24" }}>{lowStock.map(p => p.name.es).join(", ")}</span>
              </div>
            )}
            <div style={s.card}>
              <table style={s.table}>
                <thead><tr>{["Producto", "Precio", "Stock", "Estado"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {products.map(p => {
                    const stock = p.stock ?? 0;
                    const stockColor = stock <= 5 ? "#ef4444" : stock <= 10 ? "#f59e0b" : "#22c55e";
                    const stockLabel = stock <= 5 ? "Crítico" : stock <= 10 ? "Bajo" : "OK";
                    return (
                      <tr key={p.id} style={s.tr}>
                        <td style={{ ...s.td, fontWeight: 500 }}>{p.name.es}</td>
                        <td style={{ ...s.td, color: "#a78bfa", fontWeight: 600 }}>{fmt(parseFloat(p.price))}</td>
                        <td style={{ ...s.td, fontWeight: 600 }}>{stock}</td>
                        <td style={s.td}><span style={{ color: stockColor, fontSize: 12, fontWeight: 600 }}>● {stockLabel}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "cashflow" && (
          <>
            <div style={s.pageHeader}>
              <h1 style={s.pageTitle}>Predictor de Cashflow</h1>
              <span style={s.pageTag}>Proyección de cobros — este mes</span>
            </div>
            <div style={s.kpiGrid}>
              <KPI label="Total a cobrar" value={fmt(monthRevenue)} sub="ingresos del mes" accent="#6366f1" />
              <KPI label="Cobrado (≤2 días)" value={fmt(cashflowData.filter(m => m.dias <= 2).reduce((s, m) => s + m.monto, 0))} sub="transferencia + MP" accent="#22c55e" />
              <KPI label="Cobro 30 días" value={fmt(cashflowData.find(m => m.dias === 30)?.monto ?? 0)} sub="tarjeta crédito" accent="#f59e0b" />
              <KPI label="Cobro 7 días" value={fmt(cashflowData.find(m => m.dias === 7)?.monto ?? 0)} sub="otros medios" accent="#94a3b8" />
            </div>
            <div style={s.twoCol}>
              <div style={s.card}>
                <h3 style={s.cardTitle}>Por medio de pago</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
                  {cashflowData.map(m => (
                    <div key={m.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <div>
                          <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>{m.name}</span>
                          <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 8 }}>Cobro en {m.dias === 1 ? "1 día" : `${m.dias} días`}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{fmt(m.monto)}</span>
                          <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 6 }}>{m.pct}%</span>
                        </div>
                      </div>
                      <div style={{ height: 6, background: "#1a1520", borderRadius: 4 }}>
                        <div style={{ width: `${m.pct}%`, height: "100%", background: m.color, borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={s.card}>
                <h3 style={s.cardTitle}>Proyección de cobros</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {[
                    { label: "Hoy - mañana", monto: cashflowData.filter(m => m.dias <= 2).reduce((s, m) => s + m.monto, 0), color: "#22c55e" },
                    { label: "Esta semana",  monto: cashflowData.find(m => m.dias === 7)?.monto ?? 0, color: "#6366f1" },
                    { label: "Este mes",     monto: cashflowData.find(m => m.dias === 30)?.monto ?? 0, color: "#f59e0b" },
                  ].map(row => (
                    <div key={row.label} style={{ ...s.cashflowRow, borderLeft: `3px solid ${row.color}` }}>
                      <span style={{ fontSize: 13, color: "#9ca3af" }}>{row.label}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: row.color }}>{fmt(row.monto)}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "#1a1520", borderRadius: 8, fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
                    💡 Los tiempos son estimados según el medio de pago. Conectá tus credenciales para datos exactos.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  layout:        { display: "flex", minHeight: "100vh", background: "#0c0a0d", color: "#e2e8f0" },
  sidebar:       { width: 220, background: "#110e12", borderRight: "1px solid #1a1520", display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0 },
  logo:          { display: "flex", alignItems: "center", gap: 10, padding: "0 20px 24px" },
  logoDot:       { width: 10, height: 10, borderRadius: "50%", background: "#a78bfa" },
  logoText:      { fontSize: 14, fontWeight: 700, color: "#f1f5f9" },
  nav:           { display: "flex", flexDirection: "column", gap: 2, padding: "0 12px", flex: 1 },
  navItem:       { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "transparent", border: "none", color: "#6b7280", fontSize: 13, fontWeight: 500, textAlign: "left", width: "100%" },
  navActive:     { background: "#1a1520", color: "#a78bfa" },
  alert:         { margin: "0 12px 16px", padding: "10px 12px", background: "#1c1506", border: "1px solid #78350f", borderRadius: 8, display: "flex", gap: 8, alignItems: "flex-start" },
  alertDot:      { width: 6, height: 6, borderRadius: "50%", background: "#fbbf24", marginTop: 4, flexShrink: 0 },
  sidebarFooter: { padding: "16px 20px 0", borderTop: "1px solid #1a1520", marginTop: 16, display: "flex", flexDirection: "column", gap: 8 },
  disconnectBtn: { background: "#1a1520", border: "1px solid #2a1f2e", color: "#9ca3af", borderRadius: 6, padding: "6px 10px", fontSize: 11 },
  main:          { flex: 1, padding: 28, overflowY: "auto" as const, maxWidth: 1100 },
  pageHeader:    { display: "flex", alignItems: "center", gap: 12, marginBottom: 24 },
  pageTitle:     { fontSize: 20, fontWeight: 700, color: "#f1f5f9" },
  pageTag:       { fontSize: 11, color: "#6b7280", background: "#1a1520", padding: "3px 10px", borderRadius: 20 },
  kpiGrid:       { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 20 },
  kpi:           { background: "#110e12", border: "1px solid #1a1520", borderRadius: 12, padding: "18px 20px", position: "relative", overflow: "hidden" },
  kpiAccent:     { position: "absolute", top: 0, left: 0, width: "100%", height: 2, borderRadius: "12px 12px 0 0" },
  kpiLabel:      { fontSize: 11, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 8 },
  kpiValue:      { fontSize: 22, fontWeight: 700, color: "#f1f5f9" },
  kpiSub:        { fontSize: 11, color: "#6b7280" },
  twoCol:        { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 },
  card:          { background: "#110e12", border: "1px solid #1a1520", borderRadius: 12, padding: "18px 20px", marginBottom: 20 },
  cardTitle:     { fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 14 },
  table:         { width: "100%", borderCollapse: "collapse" as const },
  th:            { textAlign: "left" as const, padding: "8px 12px", fontSize: 11, color: "#4b5563", borderBottom: "1px solid #1a1520", fontWeight: 500 },
  tr:            { borderBottom: "1px solid #110e12" },
  td:            { padding: "10px 12px", fontSize: 12, color: "#d1d5db" },
  cashflowRow:   { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#0c0a0d", borderRadius: 8 },
  alertBanner:   { display: "flex", alignItems: "center", gap: 10, background: "#1c1506", border: "1px solid #78350f", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: "#d97706", flexWrap: "wrap" as const },
};
