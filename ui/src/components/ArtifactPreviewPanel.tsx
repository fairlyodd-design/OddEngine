import React from "react";

type Props = {
  artifact: any;
};

export default function ArtifactPreviewPanel({ artifact }: Props) {
  if (!artifact) {
    return <div style={{ padding: 12 }}>No artifact selected</div>;
  }

  const path = artifact.path || artifact.outputPath || "";
  const type = artifact.type || artifact.kind || "";
  const content = artifact.content || artifact.previewText || artifact.summary || path || "Preview not available";

  function renderPreview() {
    if (type.includes("video")) {
      if (path) return <video src={path} controls style={{ width: "100%" }} />;
      return <div style={{ whiteSpace: "pre-wrap" }}>{artifact.posterText || content}</div>;
    }
    if (type.includes("audio") || type.includes("song")) {
      if (path) return <audio src={path} controls style={{ width: "100%" }} />;
      return <div style={{ whiteSpace: "pre-wrap" }}>{content}</div>;
    }
    if (type.includes("image") || type.includes("cartoon")) {
      if (path) return <img src={path} style={{ width: "100%" }} />;
      return <div style={{ whiteSpace: "pre-wrap" }}>{content}</div>;
    }
    return (
      <div style={{ whiteSpace: "pre-wrap" }}>
        {content}
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <h3>🎞 Artifact Preview</h3>
      <div style={{ marginBottom: 8 }}>
        <strong>{artifact.title || "Artifact"}</strong>
      </div>
      {renderPreview()}
    </div>
  );
}
