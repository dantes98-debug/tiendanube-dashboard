import axios from "axios";

export interface TiendanubeConfig {
  storeId: string;
  accessToken: string;
}

export interface Order {
  id: number;
  number: number;
  status: string;
  payment_status: string;
  total: string;
  currency: string;
  created_at: string;
  customer: { name: string; email: string } | null;
  products: { name: string; quantity: number; price: string }[];
}

export interface Product {
  id: number;
  name: { es: string };
  stock: number | null;
  price: string;
  variants: { stock: number | null; price: string }[];
}

export interface SalesMetrics {
  today: { revenue: number; orders: number; currency: string };
  thisWeek: { revenue: number; orders: number };
  thisMonth: { revenue: number; orders: number };
  dailySales: { date: string; revenue: number; orders: number }[];
}

// --- MOCK DATA (se usa cuando no hay credenciales reales) ---
function getMockMetrics(): SalesMetrics {
  const today = new Date();
  const dailySales = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    const revenue = Math.floor(Math.random() * 80000) + 20000;
    return {
      date: d.toISOString().split("T")[0],
      revenue,
      orders: Math.floor(revenue / 8000) + Math.floor(Math.random() * 3),
    };
  });

  const todayData = dailySales[dailySales.length - 1];
  const weekData = dailySales.slice(-7);
  const monthData = dailySales;

  return {
    today: { revenue: todayData.revenue, orders: todayData.orders, currency: "ARS" },
    thisWeek: {
      revenue: weekData.reduce((s, d) => s + d.revenue, 0),
      orders: weekData.reduce((s, d) => s + d.orders, 0),
    },
    thisMonth: {
      revenue: monthData.reduce((s, d) => s + d.revenue, 0),
      orders: monthData.reduce((s, d) => s + d.orders, 0),
    },
    dailySales,
  };
}

function getMockOrders(): Order[] {
  const statuses = ["open", "closed", "cancelled"];
  const paymentStatuses = ["paid", "pending", "abandoned"];
  const names = ["María García", "Juan Pérez", "Ana López", "Carlos Ruiz", "Laura Martínez"];
  return Array.from({ length: 20 }, (_, i) => ({
    id: 1000 + i,
    number: 1000 + i,
    status: statuses[i % 3],
    payment_status: paymentStatuses[i % 3],
    total: (Math.floor(Math.random() * 50000) + 5000).toString(),
    currency: "ARS",
    created_at: new Date(Date.now() - i * 3600000 * 8).toISOString(),
    customer: { name: names[i % 5], email: `cliente${i}@example.com` },
    products: [{ name: `Producto ${(i % 5) + 1}`, quantity: (i % 3) + 1, price: "10000" }],
  }));
}

function getMockProducts(): Product[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: 100 + i,
    name: { es: `Producto ${i + 1}` },
    stock: Math.floor(Math.random() * 100),
    price: (Math.floor(Math.random() * 40000) + 5000).toString(),
    variants: [{ stock: Math.floor(Math.random() * 50), price: "10000" }],
  }));
}

// --- CLIENTE REAL ---
export class TiendanubeClient {
  private config: TiendanubeConfig | null;
  private useMock: boolean;

  constructor(config?: TiendanubeConfig) {
    this.config = config ?? null;
    this.useMock = !config?.storeId || !config?.accessToken;
    if (this.useMock) {
      console.log("[Tiendanube] Usando datos de prueba (mock). Configura STORE_ID y ACCESS_TOKEN para datos reales.");
    }
  }

  private get http() {
    if (!this.config) throw new Error("No hay credenciales configuradas");
    return axios.create({
      baseURL: `https://api.tiendanube.com/v1/${this.config.storeId}`,
      headers: {
        Authentication: `bearer ${this.config.accessToken}`,
        "User-Agent": "TiendanubeMCP/1.0",
      },
    });
  }

  async getOrders(params?: { since?: string; status?: string; limit?: number }): Promise<Order[]> {
    if (this.useMock) return getMockOrders();
    const res = await this.http.get("/orders", {
      params: { per_page: params?.limit ?? 50, status: params?.status, created_at_min: params?.since },
    });
    return res.data;
  }

  async getProducts(): Promise<Product[]> {
    if (this.useMock) return getMockProducts();
    const res = await this.http.get("/products", { params: { per_page: 50 } });
    return res.data;
  }

  async getSalesMetrics(): Promise<SalesMetrics> {
    if (this.useMock) return getMockMetrics();

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [todayOrders, weekOrders, monthOrders] = await Promise.all([
      this.getOrders({ since: startOfDay, status: "closed" }),
      this.getOrders({ since: startOfWeek, status: "closed" }),
      this.getOrders({ since: startOfMonth, status: "closed" }),
    ]);

    const sum = (orders: Order[]) =>
      orders.reduce((s, o) => s + parseFloat(o.total), 0);

    // Agrupar ventas por día (últimos 30 días)
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29).toISOString();
    const allOrders = await this.getOrders({ since: thirtyDaysAgo, status: "closed" });

    const byDay = new Map<string, { revenue: number; orders: number }>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (29 - i));
      byDay.set(d.toISOString().split("T")[0], { revenue: 0, orders: 0 });
    }
    for (const o of allOrders) {
      const day = o.created_at.split("T")[0];
      const existing = byDay.get(day);
      if (existing) {
        existing.revenue += parseFloat(o.total);
        existing.orders += 1;
      }
    }

    return {
      today: { revenue: sum(todayOrders), orders: todayOrders.length, currency: "ARS" },
      thisWeek: { revenue: sum(weekOrders), orders: weekOrders.length },
      thisMonth: { revenue: sum(monthOrders), orders: monthOrders.length },
      dailySales: Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v })),
    };
  }

  async getLowStockProducts(threshold = 5): Promise<Product[]> {
    const products = await this.getProducts();
    return products.filter((p) => {
      const stock = p.stock ?? p.variants.reduce((s, v) => s + (v.stock ?? 0), 0);
      return stock <= threshold;
    });
  }
}
