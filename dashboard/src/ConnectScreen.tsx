import { useState } from "react";
import { saveCredentials } from "./api";

export default function ConnectScreen({ onConnect }: { onConnect: () => void }) {
  const [storeId, setStoreId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId.trim() || !accessToken.trim()) {
      setError("Completá ambos campos.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
      const res = await fetch(`${API_BASE}/metrics`, {
        headers: { "x-store-id": storeId.trim(), "x-access-token": accessToken.trim() },
      });
      if (!res.ok) throw new Error("Credenciales inválidas o error de conexión.");
      saveCredentials({ storeId: storeId.trim(), accessToken: accessToken.trim() });
      onConnect();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.bg}>
      <style>{`@keyframes fade { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:none } }`}</style>
      <div style={s.card}>
        <div style={s.logo}>
          <div style={s.dot} />
          <span style={s.logoText}>Mi Tienda · Dashboard</span>
        </div>

        <h1 style={s.title}>Conectá tu Tiendanube</h1>
        <p style={s.sub}>
          Tus credenciales se guardan solo en tu browser. Nunca pasan por nuestros servidores.
        </p>

        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>
            Store ID
            <input
              style={s.input}
              type="text"
              placeholder="Ej: 123456"
              value={storeId}
              onChange={e => setStoreId(e.target.value)}
              autoFocus
            />
            <span style={s.hint}>Lo encontrás en la URL de tu admin: mitienda.mitiendanube.com/admin — o en Ajustes → Datos de la tienda</span>
          </label>

          <label style={s.label}>
            Access Token
            <input
              style={s.input}
              type="password"
              placeholder="Tu token de API"
              value={accessToken}
              onChange={e => setAccessToken(e.target.value)}
            />
            <span style={s.hint}>Tiendanube → Mi cuenta → Aplicaciones → Crear app → copiá el token</span>
          </label>

          {error && <div style={s.error}>{error}</div>}

          <button type="submit" style={{ ...s.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {loading ? "Verificando..." : "Conectar tienda →"}
          </button>
        </form>

        <div style={s.demoBox}>
          <span style={s.demoDot}>●</span>
          <span>¿Querés ver el demo primero?{" "}
            <button style={s.demoBtn} onClick={() => { saveCredentials({ storeId: "demo", accessToken: "demo" }); onConnect(); }}>
              Entrar con datos de prueba
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  bg:        { minHeight: "100vh", background: "#0c0a0d", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  card:      { background: "#110e12", border: "1px solid #1a1520", borderRadius: 16, padding: "40px 36px", width: "100%", maxWidth: 460, animation: "fade 0.3s ease" },
  logo:      { display: "flex", alignItems: "center", gap: 8, marginBottom: 28 },
  dot:       { width: 10, height: 10, borderRadius: "50%", background: "#a78bfa" },
  logoText:  { fontSize: 14, fontWeight: 600, color: "#6b7280" },
  title:     { fontSize: 24, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 },
  sub:       { fontSize: 13, color: "#6b7280", marginBottom: 28, lineHeight: 1.5 },
  form:      { display: "flex", flexDirection: "column", gap: 20 },
  label:     { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#9ca3af" },
  input:     { background: "#0c0a0d", border: "1px solid #2a1f2e", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 14, outline: "none" },
  hint:      { fontSize: 11, color: "#4b5563", fontWeight: 400, lineHeight: 1.4 },
  error:     { background: "#1c0707", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#fca5a5" },
  btn:       { background: "#6366f1", border: "none", borderRadius: 8, padding: "12px", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  demoBox:   { display: "flex", alignItems: "flex-start", gap: 8, marginTop: 24, padding: "12px 14px", background: "#0c0a0d", borderRadius: 8, fontSize: 12, color: "#6b7280" },
  demoDot:   { color: "#22c55e", fontSize: 8, marginTop: 2, flexShrink: 0 },
  demoBtn:   { background: "none", border: "none", color: "#a78bfa", cursor: "pointer", textDecoration: "underline", fontSize: 12, padding: 0 },
};
