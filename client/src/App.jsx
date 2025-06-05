import React, { useState, useRef } from "react";
import axios from "axios";
import * as tus from "tus-js-client";

export default function App() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [eta, setEta] = useState(null);
  const [status, setStatus] = useState("Idle");

  const uploadRef = useRef(null);
  const lastUploadedRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds === Infinity) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a video file.");
    if (uploading) return;

    setUploading(true);
    setStatus("Creating Bunny video...");

    try {
      const { data: createData } = await axios.post(
        "http://localhost:5000/api/create-video-entry",
        { title: file.name }
      );
      const videoId = createData.guid;

      setStatus("Generating signed auth...");

      const { data: authData } = await axios.post(
        "http://localhost:5000/api/generate-tus-auth",
        { videoId }
      );

      setStatus("Uploading...");

      const upload = new tus.Upload(file, {
        endpoint: "https://video.bunnycdn.com/tusupload",
        chunkSize: 200 * 1024 * 1024,
        retryDelays: [0],
        metadata: {
          filetype: file.type,
          title: file.name,
        },
        headers: {
          AuthorizationSignature: authData.authorizationSignature,
          AuthorizationExpire: authData.authorizationExpire,
          LibraryId: authData.libraryId,
          VideoId: authData.videoId,
        },
        onError: (error) => {
          alert("Upload failed: " + error.message);
          setStatus("❌ Upload failed");
          setUploading(false);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const now = Date.now();
          const deltaTime = (now - lastTimeRef.current) / 1000;
          const deltaBytes = bytesUploaded - lastUploadedRef.current;

          if (deltaTime > 0) {
            const currentSpeed = deltaBytes / deltaTime;
            setSpeed(currentSpeed);
            const bytesLeft = bytesTotal - bytesUploaded;
            const estTime = currentSpeed > 0 ? bytesLeft / currentSpeed : Infinity;
            setEta(estTime);
          }

          lastUploadedRef.current = bytesUploaded;
          lastTimeRef.current = now;

          setProgress(Math.floor((bytesUploaded / bytesTotal) * 100));
          setStatus(`Uploading: ${formatBytes(bytesUploaded)} / ${formatBytes(bytesTotal)}`);
        },
        onSuccess: async () => {
          setProgress(100);
          setSpeed(0);
          setEta(0);
          setStatus("Upload done ✅ Saving metadata...");

          try {
            await axios.post("http://localhost:5000/api/save-video-metadata", {
              title: file.name,
              description: `Uploaded on ${new Date().toLocaleString()}`,
              videoId,
              thumbnailUrl: "",
            });

            setStatus("✅ Metadata saved!");
            setFile(null);
            alert("🎉 Upload completed successfully!");
          } catch (error) {
            setStatus("❌ Failed to save metadata");
            alert("Metadata save failed: " + error.message);
          } finally {
            setUploading(false);
          }
        },
      });

      uploadRef.current = upload;
      const previous = await upload.findPreviousUploads();
      if (previous.length > 0) {
        upload.resumeFromPreviousUpload(previous[0]);
      }

      upload.start();
    } catch (err) {
      alert("Error: " + err.message);
      setStatus("❌ Upload error");
      setUploading(false);
    }
  };

  const handlePause = () => {
    if (uploadRef.current && uploading) {
      uploadRef.current.abort();
      setStatus("⏸️ Upload paused");
      setUploading(false);
    }
  };

  const handleResume = () => {
    if (uploadRef.current && !uploading) {
      setUploading(true);
      setStatus("🔄 Resuming upload...");
      uploadRef.current.start();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      padding: '3rem',
      fontFamily: "'Inter', system-ui",
      color: '#fff'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: '#111',
        borderRadius: '20px',
        padding: '3rem',
        border: '1px solid #222',
        boxShadow: '0 10px 20px rgba(0,0,0,0.4)'
      }}>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🚀 Video Uploader
        </h1>

        <label htmlFor="upload-input" style={{
          display: 'block',
          padding: '2rem',
          background: uploading ? '#1a1a1a' : '#161616',
          border: '2px dashed #4f46e5',
          borderRadius: '14px',
          textAlign: 'center',
          cursor: 'pointer'
        }}>
          <input
            id="upload-input"
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            disabled={uploading}
            onChange={(e) => setFile(e.target.files[0])}
          />
          <div>
            <div style={{ fontSize: '2rem' }}>📁</div>
            <p>{file ? file.name : "Click to select a video file"}</p>
            <p style={{ fontSize: '0.85rem', color: '#888' }}>
              {file ? `Size: ${formatBytes(file.size)}` : "Supports all formats"}
            </p>
          </div>
        </label>

        <div style={{
          marginTop: '2rem',
          height: '10px',
          background: '#222',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: progress === 100 ? '#16a34a' : '#4f46e5',
            transition: 'width 0.3s ease'
          }} />
        </div>

        <div style={{ marginTop: '2rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {[
            { label: "Status", value: status },
            { label: "Progress", value: `${progress}%` },
            { label: "Speed", value: speed ? `${formatBytes(speed)}/s` : "--" },
            { label: "ETA", value: formatTime(eta) },
          ].map((stat, index) => (
            <div key={index} style={{
              background: '#1a1a1a',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid #333'
            }}>
              <p style={{ color: '#888', fontSize: '0.8rem' }}>{stat.label}</p>
              <p style={{ fontWeight: '600', fontSize: '1rem' }}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          {!uploading ? (
            <button
              onClick={handleUpload}
              disabled={!file}
              style={{
                flex: 1,
                padding: '1rem',
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 'bold',
                cursor: file ? 'pointer' : 'not-allowed',
                opacity: file ? 1 : 0.6
              }}
            >
              {file ? '🚀 Start Upload' : 'Select a file'}
            </button>
          ) : (
            <>
              <button
                onClick={handlePause}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ⏸️ Pause
              </button>
              <button
                onClick={handleResume}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: '#22c55e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ▶️ Resume
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
