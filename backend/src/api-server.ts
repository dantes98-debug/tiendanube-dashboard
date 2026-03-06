import express, { Request } from "express";
import cors from "cors";
import { TiendanubeClient } from "./tiendanube.js";

const app = express();
app.use(cors());
app.use(express.json());

function getClient(req: Request) {
  const storeId = (req.headers["x-store-id"] as string) || process.env.STORE_ID || "";
  const accessToken = (req.headers["x-access-token"] as string) || process.env.ACCESS_TOKEN || "";
  return new TiendanubeClient(
    storeId && accessToken ? { storeId, accessToken } : undefined
  );
}

app.get("/api/metrics", async (req, res) => {
  try {
    const data = await getClient(req).getSalesMetrics();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    const data = await getClient(req).getOrders({
      status: req.query.status as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get("/api/products", async (_req, res) => {
  try {
    const data = await getClient(_req).getProducts();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get("/api/low-stock", async (req, res) => {
  try {
    const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : 5;
    const data = await getClient(req).getLowStockProducts(threshold);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`API REST corriendo en http://localhost:${PORT}`);
});
