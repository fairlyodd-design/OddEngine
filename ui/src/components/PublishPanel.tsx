
import React, { useEffect, useState } from "react";
import { createPublishJob, simulatePublish, PublishJob, PublishTarget } from "../lib/publishEngine";
import { probePublishBridge, publishRealWorld } from "../lib/realPublishBridge";
import { generatePublishMetadata } from "../lib/publishMetadata";
import { probeAuthBridge, startAuthFlow } from "../lib/publishAuthBridge";
import { probeOAuthVault, saveOAuthToken, listOAuthProviders } from "../lib/oauthVaultBridge";
import { probeRealUploader, uploadRealArtifact } from "../lib/realUploaderBridge";
import { probeEncryptedVault, storeEncryptedSecret, listEncryptedProviders } from "../lib/encryptedSecretsVaultBridge";
import { probeOAuthCallbackCompletion, completeOAuthCallback } from "../lib/oauthCallbackCompletionBridge";
import { probePublisherConnectors, listPublisherConnectors, startPublisherConnectorFlow, finalizePublisherConnectorFlow } from "../lib/publisherConnectorBridge";

const targets: PublishTarget[] = ["youtube","gumroad","kdp","tiktok"];

export default function PublishPanel() {
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [target, setTarget] = useState<PublishTarget>("youtube");
  const [artifactPath, setArtifactPath] = useState("");
  const [bridgeStatus, setBridgeStatus] = useState<any>({ok:false, status:"unknown"});
  const [authStatus, setAuthStatus] = useState<any>({ok:false, status:"unknown"});
  const [vaultStatus, setVaultStatus] = useState<any>({ok:false, status:"unknown"});
  const [uploaderStatus, setUploaderStatus] = useState<any>({ok:false, status:"unknown"});
  const [encryptedVaultStatus, setEncryptedVaultStatus] = useState<any>({ok:false, status:"unknown"});
  const [callbackStatus, setCallbackStatus] = useState<any>({ok:false, status:"unknown"});
  const [connectorStatus, setConnectorStatus] = useState<any>({ok:false, status:"unknown"});
  const [providers, setProviders] = useState<string[]>([]);
  const [encryptedProviders, setEncryptedProviders] = useState<string[]>([]);
  const [connectorProviders, setConnectorProviders] = useState<string[]>([]);
  const [metadataPreview, setMetadataPreview] = useState<any>(null);
  const [callbackProvider, setCallbackProvider] = useState<"youtube" | "gumroad">("youtube");
  const [callbackCode, setCallbackCode] = useState("");
  const [callbackState, setCallbackState] = useState("");
  const [flowId, setFlowId] = useState("");

  useEffect(() => {
    refreshBridge();
    refreshAuth();
    refreshVault();
    refreshUploader();
    refreshEncryptedVault();
    refreshCallbackStatus();
    refreshConnectors();
  }, []);

  async function refreshBridge() { setBridgeStatus(await probePublishBridge()); }
  async function refreshAuth() { setAuthStatus(await probeAuthBridge()); }
  async function refreshVault() {
    const status = await probeOAuthVault();
    setVaultStatus(status);
    try {
      const data = await listOAuthProviders();
      setProviders(Array.isArray(data.providers) ? data.providers : []);
    } catch {
      setProviders([]);
    }
  }
  async function refreshUploader() { setUploaderStatus(await probeRealUploader()); }
  async function refreshEncryptedVault() {
    const status = await probeEncryptedVault();
    setEncryptedVaultStatus(status);
    try {
      const data = await listEncryptedProviders();
      setEncryptedProviders(Array.isArray(data.providers) ? data.providers : []);
    } catch {
      setEncryptedProviders([]);
    }
  }
  async function refreshCallbackStatus() { setCallbackStatus(await probeOAuthCallbackCompletion()); }
  async function refreshConnectors() {
    const status = await probePublisherConnectors();
    setConnectorStatus(status);
    try {
      const data = await listPublisherConnectors();
      setConnectorProviders(Array.isArray(data.providers) ? data.providers : []);
    } catch {
      setConnectorProviders([]);
    }
  }

  function create() {
    const job = createPublishJob(title, desc, target);
    setJobs([job, ...jobs]);
  }

  function publish(id: string) {
    setJobs(jobs.map(j => j.id === id ? simulatePublish(j) : j));
  }

  async function publishLive(id: string) {
    const job = jobs.find(j => j.id === id);
    if (!job) return;
    const result = await publishRealWorld({
      title: job.title,
      description: job.description,
      target: job.target,
      artifactPath,
      tags: metadataPreview?.tags || [],
      thumbnailPath: metadataPreview?.thumbnailPrompt || "",
    });
    setJobs(jobs.map(j => j.id === id ? {
      ...j,
      status: result.ok ? "published" : "failed",
      url: result.url || j.url,
    } : j));
  }

  async function uploadReal(id: string) {
    const job = jobs.find(j => j.id === id);
    if (!job || (job.target !== "youtube" && job.target !== "gumroad")) return;
    const result = await uploadRealArtifact({
      provider: job.target,
      title: job.title,
      description: job.description,
      artifactPath,
      tags: metadataPreview?.tags || [],
      thumbnailPath: metadataPreview?.thumbnailPrompt || "",
    });
    setJobs(jobs.map(j => j.id === id ? {
      ...j,
      status: result.ok ? "published" : "failed",
      url: result.url || j.url,
    } : j));
  }

  function generateMeta() {
    if (target !== "youtube" && target !== "gumroad") return;
    const meta = generatePublishMetadata(`${title} ${desc}`.trim(), target);
    setMetadataPreview(meta);
    setTitle(meta.title);
    setDesc(meta.description);
  }

  async function auth(targetName: "youtube" | "gumroad") {
    const result = await startAuthFlow(targetName);
    setAuthStatus({ ok: true, status: result.status || "started", detail: result.url || result.detail || "" });
  }

  async function storeMockToken(provider: "youtube" | "gumroad") {
    const result = await saveOAuthToken(provider, {
      access_token: `mock-${provider}-access-token`,
      refresh_token: `mock-${provider}-refresh-token`,
      scope: ["upload", "metadata"],
    });
    setVaultStatus({ ok: true, status: result.status || "stored", detail: result.detail || "" });
    refreshVault();
  }

  async function storeEncryptedMockSecret(provider: "youtube" | "gumroad") {
    const result = await storeEncryptedSecret(provider, {
      access_token: `encrypted-${provider}-access-token`,
      refresh_token: `encrypted-${provider}-refresh-token`,
      scope: ["upload", "metadata"],
    });
    setEncryptedVaultStatus({ ok: true, status: result.status || "stored", detail: result.detail || "" });
    refreshEncryptedVault();
  }

  async function completeCallback() {
    const result = await completeOAuthCallback(callbackProvider, callbackCode, callbackState);
    setCallbackStatus({ ok: true, status: result.status || "completed", detail: result.detail || result.provider || "" });
  }

  async function startConnectorFlow(provider: any) {
    const result = await startPublisherConnectorFlow(provider, artifactPath, {
      title,
      description: desc,
      tags: metadataPreview?.tags || [],
    });
    setConnectorStatus({ ok: result.ok, status: result.status, detail: result.detail || result.url || "" });
    if ((result as any).flowId) setFlowId((result as any).flowId);
  }

  async function finalizeConnectorFlow(provider: any) {
    const result = await finalizePublisherConnectorFlow(provider, flowId);
    setConnectorStatus({ ok: result.ok, status: result.status, detail: result.detail || result.url || "" });
  }

  return (
    <div style={{ padding: 12, color: "#eaf5ff" }}>
      <h3>🚀 Real Publisher Connector Flows</h3>
      <div style={{ opacity: .82, marginBottom: 12 }}>Run end-to-end connector flows for YouTube, Gumroad, KDP, and TikTok through a backend connector service.</div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={refreshBridge}>Probe Publish Bridge</button>
          <button onClick={refreshAuth}>Probe Auth Bridge</button>
          <button onClick={refreshVault}>Probe OAuth Vault</button>
          <button onClick={refreshUploader}>Probe Uploader</button>
          <button onClick={refreshEncryptedVault}>Probe Encrypted Vault</button>
          <button onClick={refreshCallbackStatus}>Probe Callback Bridge</button>
          <button onClick={refreshConnectors}>Probe Connectors</button>
        </div>

        <div>Publish Bridge: <strong>{bridgeStatus.status}</strong>{bridgeStatus.detail ? ` • ${bridgeStatus.detail}` : ""}</div>
        <div>Auth Bridge: <strong>{authStatus.status}</strong>{authStatus.detail ? ` • ${authStatus.detail}` : ""}</div>
        <div>OAuth Vault: <strong>{vaultStatus.status}</strong>{vaultStatus.detail ? ` • ${vaultStatus.detail}` : ""}</div>
        <div>Uploader: <strong>{uploaderStatus.status}</strong>{uploaderStatus.detail ? ` • ${uploaderStatus.detail}` : ""}</div>
        <div>Encrypted Vault: <strong>{encryptedVaultStatus.status}</strong>{encryptedVaultStatus.detail ? ` • ${encryptedVaultStatus.detail}` : ""}</div>
        <div>Callback Bridge: <strong>{callbackStatus.status}</strong>{callbackStatus.detail ? ` • ${callbackStatus.detail}` : ""}</div>
        <div>Connector Bridge: <strong>{connectorStatus.status}</strong>{connectorStatus.detail ? ` • ${connectorStatus.detail}` : ""}</div>
        <div>Stored Providers: <strong>{providers.length ? providers.join(", ") : "none"}</strong></div>
        <div>Encrypted Providers: <strong>{encryptedProviders.length ? encryptedProviders.join(", ") : "none"}</strong></div>
        <div>Connector Providers: <strong>{connectorProviders.length ? connectorProviders.join(", ") : "none"}</strong></div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => auth("youtube")}>Auth YouTube</button>
          <button onClick={() => auth("gumroad")}>Auth Gumroad</button>
          <button onClick={() => storeMockToken("youtube")}>Store Mock YouTube Token</button>
          <button onClick={() => storeMockToken("gumroad")}>Store Mock Gumroad Token</button>
          <button onClick={() => storeEncryptedMockSecret("youtube")}>Store Encrypted YouTube Secret</button>
          <button onClick={() => storeEncryptedMockSecret("gumroad")}>Store Encrypted Gumroad Secret</button>
        </div>

        <div style={{ border: "1px solid rgba(120,180,255,.18)", borderRadius: 12, background: "rgba(10,16,28,.82)", padding: 12 }}>
          <strong>OAuth Callback Completion</strong>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <select value={callbackProvider} onChange={e => setCallbackProvider(e.target.value as any)} style={field}>
              <option value="youtube">youtube</option>
              <option value="gumroad">gumroad</option>
            </select>
            <input placeholder="OAuth code" value={callbackCode} onChange={e => setCallbackCode(e.target.value)} style={field} />
            <input placeholder="OAuth state" value={callbackState} onChange={e => setCallbackState(e.target.value)} style={field} />
            <button onClick={completeCallback}>Complete OAuth Callback</button>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(120,180,255,.18)", borderRadius: 12, background: "rgba(10,16,28,.82)", padding: 12 }}>
          <strong>Connector Flow Control</strong>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <input placeholder="Artifact path or URL" value={artifactPath} onChange={e=>setArtifactPath(e.target.value)} style={field} />
            <input placeholder="Flow Id (used for finalize)" value={flowId} onChange={e=>setFlowId(e.target.value)} style={field} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => startConnectorFlow("youtube")}>Start YouTube Connector</button>
              <button onClick={() => finalizeConnectorFlow("youtube")}>Finalize YouTube Connector</button>
              <button onClick={() => startConnectorFlow("gumroad")}>Start Gumroad Connector</button>
              <button onClick={() => finalizeConnectorFlow("gumroad")}>Finalize Gumroad Connector</button>
              <button onClick={() => startConnectorFlow("kdp")}>Start KDP Connector</button>
              <button onClick={() => finalizeConnectorFlow("kdp")}>Finalize KDP Connector</button>
              <button onClick={() => startConnectorFlow("tiktok")}>Start TikTok Connector</button>
              <button onClick={() => finalizeConnectorFlow("tiktok")}>Finalize TikTok Connector</button>
            </div>
          </div>
        </div>

        <input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} style={field} />
        <textarea placeholder="Description" value={desc} onChange={e=>setDesc(e.target.value)} style={{...field, minHeight: 90}} />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={target} onChange={e=>setTarget(e.target.value as PublishTarget)} style={field}>
            {targets.map(t => <option key={t}>{t}</option>)}
          </select>

          <button onClick={create}>Create Publish Job</button>
          {(target === "youtube" || target === "gumroad") && <button onClick={generateMeta}>Generate Metadata</button>}
        </div>

        {metadataPreview && (
          <div style={{ border: "1px solid rgba(120,180,255,.18)", borderRadius: 12, background: "rgba(10,16,28,.82)", padding: 12 }}>
            <strong>Metadata Preview</strong>
            <div style={{ marginTop: 8 }}><b>Title:</b> {metadataPreview.title}</div>
            <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}><b>Description:</b> {metadataPreview.description}</div>
            <div style={{ marginTop: 8 }}><b>Tags:</b> {metadataPreview.tags.join(", ")}</div>
            <div style={{ marginTop: 8 }}><b>Thumbnail Prompt:</b> {metadataPreview.thumbnailPrompt}</div>
          </div>
        )}

        {jobs.map(j => (
          <div key={j.id} style={{ border:"1px solid rgba(120,180,255,.18)", marginTop:8, padding:12, borderRadius: 12, background: "rgba(10,16,28,.82)" }}>
            <strong>{j.title || "Untitled"}</strong>
            <div style={{ opacity: .82 }}>{j.target} • {j.status}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {j.status !== "published" && <button onClick={()=>publish(j.id)}>Sim Publish</button>}
              {j.status !== "published" && <button onClick={()=>publishLive(j.id)}>Live Publish Bridge</button>}
              {(j.target === "youtube" || j.target === "gumroad") && j.status !== "published" && (
                <button onClick={()=>uploadReal(j.id)}>Real Upload Starter</button>
              )}
            </div>
            {j.url && <div style={{ marginTop: 8 }}>Live: {j.url}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

const field: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  background: "rgba(11,18,31,.95)",
  color: "#eef7ff",
  border: "1px solid rgba(120,180,255,.18)",
};
