import React from "react";
import ArtifactPreviewPanel from "./ArtifactPreviewPanel";
import { buildDownloadHref, type MaterializedArtifact } from "../lib/artifactMaterializer";

type Props = {
  artifacts: MaterializedArtifact[];
  selectedArtifactId: string;
  onSelect: (artifactId: string) => void;
};

export default function OutputLibraryPanel({ artifacts, selectedArtifactId, onSelect }: Props) {
  const selected = artifacts.find((item) => item.id === selectedArtifactId) || artifacts[0] || null;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1.1fr" }}>
        <div className="card softCard" style={{ padding: 14 }}>
          <div className="cluster wrap spread">
            <div>
              <div className="h">Finished products library</div>
              <div className="sub">Every packaged run lands here so it can be previewed, downloaded, and shipped.</div>
            </div>
            <span className="badge good">{artifacts.length} ready</span>
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 12, maxHeight: 420, overflow: "auto" }}>
            {artifacts.length ? artifacts.map((artifact) => {
              const active = artifact.id === selectedArtifactId;
              return (
                <button
                  key={artifact.id}
                  onClick={() => onSelect(artifact.id)}
                  className="tabBtn"
                  style={{
                    textAlign: "left",
                    display: "grid",
                    gap: 6,
                    padding: 12,
                    borderRadius: 16,
                    border: active ? "1px solid rgba(115,255,180,0.42)" : "1px solid rgba(255,255,255,0.08)",
                    background: active ? "rgba(25,100,74,0.22)" : "rgba(8,12,18,0.38)",
                  }}
                >
                  <div className="cluster wrap spread">
                    <div style={{ fontWeight: 800 }}>{artifact.title}</div>
                    <span className="badge">{artifact.kind}</span>
                  </div>
                  <div className="small">{artifact.status === "ready" ? "Audience-ready package saved locally" : "Script / package ready • final media render still depends on backend"}</div>
                  <div className="small" style={{ opacity: 0.74 }}>{new Date(artifact.createdAt).toLocaleString()}</div>
                </button>
              );
            }) : <div className="small" style={{ opacity: 0.76 }}>No finished products yet. Finish the package stage and the artifact library will populate automatically.</div>}
          </div>
        </div>

        <div className="card softCard" style={{ padding: 14 }}>
          <div className="h">Selected artifact actions</div>
          <div className="sub">Open the final pack, pull supporting files, or hand it off to publish flows.</div>
          {selected ? (
            <>
              <div className="note" style={{ marginTop: 10 }}>{selected.summary}</div>
              <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
                {selected.files.map((file) => (
                  <a key={file.name} className="tabBtn" href={buildDownloadHref(file)} download={file.name}>{file.role || "download"}: {file.name}</a>
                ))}
              </div>
              <ul className="small" style={{ marginTop: 10, paddingLeft: 18 }}>
                {selected.monetization.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </>
          ) : <div className="small" style={{ marginTop: 10, opacity: 0.76 }}>Pick an artifact to preview it here.</div>}
        </div>
      </div>

      <div className="card softCard" style={{ padding: 14 }}>
        <ArtifactPreviewPanel artifact={selected} />
      </div>
    </div>
  );
}
