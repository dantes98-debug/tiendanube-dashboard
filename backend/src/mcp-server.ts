import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TiendanubeClient } from "./tiendanube.js";

const client = new TiendanubeClient(
  process.env.STORE_ID && process.env.ACCESS_TOKEN
    ? { storeId: process.env.STORE_ID, accessToken: process.env.ACCESS_TOKEN }
    : undefined
);

const server = new Server(
  { name: "tiendanube-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_sales_metrics",
      description: "Obtiene métricas de ventas: ingresos de hoy, semana, mes y ventas diarias de los últimos 30 días",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_orders",
      description: "Lista órdenes recientes de la tienda",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["open", "closed", "cancelled"], description: "Filtrar por estado" },
          limit: { type: "number", description: "Cantidad máxima de órdenes (default: 20)" },
        },
      },
    },
    {
      name: "get_products",
      description: "Lista todos los productos de la tienda con stock y precio",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_low_stock",
      description: "Productos con stock bajo o crítico",
      inputSchema: {
        type: "object",
        properties: {
          threshold: { type: "number", description: "Umbral de stock bajo (default: 5)" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_sales_metrics") {
      const metrics = await client.getSalesMetrics();
      const fmt = (n: number) =>
        new Intl.NumberFormat("es-AR", { style: "currency", currency: metrics.today.currency }).format(n);

      return {
        content: [
          {
            type: "text",
            text: [
              `📊 **Métricas de tu tienda**`,
              ``,
              `**Hoy:** ${fmt(metrics.today.revenue)} · ${metrics.today.orders} órdenes`,
              `**Esta semana:** ${fmt(metrics.thisWeek.revenue)} · ${metrics.thisWeek.orders} órdenes`,
              `**Este mes:** ${fmt(metrics.thisMonth.revenue)} · ${metrics.thisMonth.orders} órdenes`,
              ``,
              `**Últimos 7 días:**`,
              ...metrics.dailySales.slice(-7).map(
                (d) => `  ${d.date}: ${fmt(d.revenue)} (${d.orders} órdenes)`
              ),
            ].join("\n"),
          },
        ],
      };
    }

    if (name === "get_orders") {
      const orders = await client.getOrders({
        status: (args as any)?.status,
        limit: (args as any)?.limit ?? 20,
      });
      const lines = orders.slice(0, 20).map(
        (o) =>
          `#${o.number} · ${o.customer?.name ?? "Sin cliente"} · $${parseFloat(o.total).toLocaleString("es-AR")} · ${o.status} / ${o.payment_status}`
      );
      return {
        content: [{ type: "text", text: `📦 **Órdenes recientes (${orders.length}):**\n\n${lines.join("\n")}` }],
      };
    }

    if (name === "get_products") {
      const products = await client.getProducts();
      const lines = products.map(
        (p) =>
          `• ${p.name.es} · Stock: ${p.stock ?? "variantes"} · $${parseFloat(p.price).toLocaleString("es-AR")}`
      );
      return {
        content: [{ type: "text", text: `🛍️ **Productos (${products.length}):**\n\n${lines.join("\n")}` }],
      };
    }

    if (name === "get_low_stock") {
      const threshold = (args as any)?.threshold ?? 5;
      const products = await client.getLowStockProducts(threshold);
      if (products.length === 0) {
        return { content: [{ type: "text", text: `✅ No hay productos con stock ≤ ${threshold}` }] };
      }
      const lines = products.map(
        (p) => `⚠️ ${p.name.es} · Stock: ${p.stock ?? 0}`
      );
      return {
        content: [{ type: "text", text: `🔴 **Stock bajo (${products.length} productos):**\n\n${lines.join("\n")}` }],
      };
    }

    throw new Error(`Herramienta desconocida: ${name}`);
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Tiendanube MCP Server iniciado");
}

main();
