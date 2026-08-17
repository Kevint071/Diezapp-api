"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

type CheckState = "idle" | "checking" | "success" | "error";
type HealthResponse = { checks?: { oauth?: boolean } };

export default function Home() {
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [latency, setLatency] = useState<number | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [oauthReady, setOauthReady] = useState<boolean | null>(null);

  async function checkHealth() {
    setCheckState("checking");
    const startedAt = performance.now();

    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const result = (await response.json()) as HealthResponse;
      setOauthReady(result.checks?.oauth ?? false);
      if (!response.ok) throw new Error("Health check failed");

      setLatency(Math.round(performance.now() - startedAt));
      setCheckedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setCheckState("success");
    } catch {
      setLatency(null);
      setCheckedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setCheckState("error");
    }
  }

  const statusLabel = {
    idle: "Sin comprobar",
    checking: "Comprobando...",
    success: "Operativo",
    error: "No disponible",
  }[checkState];

  return (
    <main className="home-shell">
      <nav className="topbar" aria-label="Navegacion principal">
        <Link className="brand" href="/" aria-label="DiezMapp inicio">
          <span className="brand-mark"><Image src="/icon-transparent.png" alt="" width={34} height={34} priority /></span>
          <span>DiezMapp</span>
        </Link>
        <span className="environment-pill"><i /> Servicio de DiezApp</span>
      </nav>

      <section className="hero" aria-labelledby="page-title">
        <div className="hero-copy">
          <p className="eyebrow">DIEZAPP / CONEXIÓN SEGURA</p>
          <h1 id="page-title">¿DiezApp<br /><em>está lista?</em></h1>
          <p className="hero-description">
            Haz una prueba rápida para confirmar que DiezApp puede conectarse con Google Drive cuando la necesites.
          </p>
          <div className="endpoint-line" aria-label="Endpoint que se comprobara">
            <span className="method-badge">GET</span>
            <code>/api/health</code>
            <span className="endpoint-purpose">Prueba de conexión</span>
          </div>
          <button className="check-button" type="button" onClick={checkHealth} disabled={checkState === "checking"}>
            <span className={checkState === "checking" ? "button-spinner" : "button-icon"} aria-hidden="true">
              {checkState === "checking" ? "" : "✓"}
            </span>
            {checkState === "checking" ? "Comprobando conexión" : "Probar conexión de DiezApp"}
          </button>
          <p className="privacy-note"><span aria-hidden="true">*</span> Es una prueba segura: no cambia nada en tu cuenta.</p>
        </div>

        <div className="status-card" aria-live="polite">
          <div className="card-topline"><span>ESTADO DE DIEZAPP</span><span className="card-dots">•••</span></div>
          <div className={`health-banner ${checkState}`}>
            <span className="health-indicator" aria-hidden="true">{checkState === "error" ? "!" : "✓"}</span>
            <span><small>ESTADO GENERAL</small><strong>{statusLabel}</strong></span>
          </div>
          <div className="health-facts">
            <span><small>ENDPOINT</small><code>/api/health</code></span>
            <span><small>LATENCIA</small><strong>{latency === null ? "--" : `${latency} ms`}</strong></span>
          </div>
          <p className="status-detail">
            {checkState === "idle" && "Lista para comprobar la conexión"}
            {checkState === "checking" && "Comprobando el servicio..."}
            {checkState === "success" && oauthReady
              ? `DiezApp respondió en ${latency} ms y OAuth está listo`
              : checkState === "success"
                ? `DiezApp respondió en ${latency} ms, pero falta configuración`
                : null}
            {checkState === "error" && "No pudimos confirmar la conexión"}
          </p>
          <div className="status-meta">
            <span><b className={checkState === "error" ? "red-dot" : "green-dot"} /> SERVICIO ACTIVO</span>
            <span>{checkedAt ? `Última prueba ${checkedAt}` : "Sin pruebas recientes"}</span>
          </div>
        </div>
      </section>

      <footer className="footer-bar">
        <span>DiezApp API <b>v1.0</b></span>
        <span className="footer-line" />
        <span>Construido para funcionar tranquilo.</span>
      </footer>
    </main>
  );
}