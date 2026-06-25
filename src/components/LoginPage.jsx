import React, { useState } from "react";

export default function LoginPage({ onLogin, onSignup, authError, setAuthError, cloudConfig, setCloudConfig }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [showConfig, setShowConfig] = useState(!cloudConfig.url || !cloudConfig.key);
  const [importCode, setImportCode] = useState("");

  const hasConfig = cloudConfig.url && cloudConfig.key;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) return;
    if (isSignup) {
      onSignup(email, password);
    } else {
      onLogin(email, password);
    }
  };

  const handleImport = () => {
    try {
      const cfg = JSON.parse(atob(importCode.trim()));
      if (!cfg.url || !cfg.key) throw new Error();
      setCloudConfig(cfg);
      localStorage.setItem("grenoucerie_cloud_config", JSON.stringify(cfg));
      setShowConfig(false);
      setAuthError(null);
    } catch {
      setAuthError("Código de configuración inválido.");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)",
      padding: "1rem",
    }}>
      <div style={{
        background: "white",
        borderRadius: "16px",
        padding: "2.5rem",
        maxWidth: "420px",
        width: "100%",
        boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🐸</div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#2e7d32" }}>Grenoucerie Control</h1>
          <p style={{ color: "#777", fontSize: "0.85rem", marginTop: "0.3rem" }}>
            Sistema de Gestión de Granja
          </p>
        </div>

        {(showConfig || !hasConfig) ? (
          <div>
            <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: "1rem" }}>
              Configura la conexión a tu base de datos Supabase:
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
                URL del Proyecto
              </label>
              <input
                type="text"
                placeholder="https://xxxxxxxx.supabase.co"
                value={cloudConfig.url}
                onChange={(e) => setCloudConfig(prev => ({ ...prev, url: e.target.value.trim() }))}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.9rem", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
                Clave Pública (Anon Key)
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOi..."
                value={cloudConfig.key}
                onChange={(e) => setCloudConfig(prev => ({ ...prev, key: e.target.value.trim() }))}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.9rem", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: "8px", padding: "0.8rem", marginBottom: "1rem" }}>
              <strong style={{ fontSize: "0.82rem", color: "#f57f17" }}>O importa un código:</strong>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <input
                  type="text"
                  placeholder="Pega el código aquí..."
                  value={importCode}
                  onChange={(e) => setImportCode(e.target.value)}
                  style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.82rem" }}
                />
                <button
                  onClick={handleImport}
                  style={{ background: "#f9a825", color: "white", border: "none", borderRadius: "6px", padding: "8px 12px", cursor: "pointer", fontSize: "0.82rem" }}
                >
                  Importar
                </button>
              </div>
            </div>

            {hasConfig && (
              <button
                onClick={() => {
                  localStorage.setItem("grenoucerie_cloud_config", JSON.stringify(cloudConfig));
                  setShowConfig(false);
                }}
                style={{ width: "100%", padding: "12px", background: "#2e7d32", color: "white", border: "none", borderRadius: "8px", fontSize: "1rem", cursor: "pointer", fontWeight: 600 }}
              >
                Continuar
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.9rem", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={isSignup ? "new-password" : "current-password"}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.9rem", boxSizing: "border-box" }}
              />
            </div>

            {authError && (
              <div style={{ background: "#ffebee", color: "#c62828", padding: "0.7rem", borderRadius: "8px", fontSize: "0.82rem", marginBottom: "1rem" }}>
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={!email || !password}
              style={{
                width: "100%",
                padding: "12px",
                background: !email || !password ? "#ccc" : "#2e7d32",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "1rem",
                cursor: !email || !password ? "default" : "pointer",
                fontWeight: 600,
                marginBottom: "0.8rem",
              }}
            >
              {isSignup ? "Crear cuenta" : "Iniciar sesión"}
            </button>

            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                onClick={() => { setIsSignup(!isSignup); setAuthError(null); }}
                style={{ background: "none", border: "none", color: "#2e7d32", cursor: "pointer", fontSize: "0.82rem", textDecoration: "underline" }}
              >
                {isSignup ? "Ya tengo cuenta — Iniciar sesión" : "No tengo cuenta — Registrarme"}
              </button>
            </div>

            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <button
                type="button"
                onClick={() => setShowConfig(true)}
                style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "0.75rem" }}
              >
                Cambiar configuración de nube
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
