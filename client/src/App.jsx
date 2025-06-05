import React, { useState, useRef } from "react";
import axios from "axios";
import * as tus from "tus-js-client";

export default function TusUploadWithProgress() {
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
    setStatus("Creating video entry...");

    try {

      const { data: createData } = await axios.post(
        "http://localhost:5000/api/create-video-entry",
        { title: file.name }
      );
      const videoId = createData.guid;

      setStatus("Getting upload credentials...");

      const { data: authData } = await axios.post(
        "http://localhost:5000/api/generate-tus-auth",
        { videoId }
      );

      setStatus("Uploading...");


      const upload = new tus.Upload(file, {
        endpoint: "https://video.bunnycdn.com/tusupload",
        chunkSize: 50 * 1024 * 1024, // 50MB optimal for faster uploads
        retryDelays: [0, 1000, 3000, 5000],
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
          setStatus("Upload failed.");
          alert("Upload failed: " + error.message);
          setUploading(false);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const now = Date.now();
          const timeDiff = (now - lastTimeRef.current) / 1000;
          const bytesDiff = bytesUploaded - lastUploadedRef.current;

          if (timeDiff > 0) {
            const currentSpeed = bytesDiff / timeDiff;
            setSpeed(currentSpeed);

            const remaining = bytesTotal - bytesUploaded;
            const estTime = currentSpeed > 0 ? remaining / currentSpeed : Infinity;
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
          setStatus("Upload completed! Saving metadata...");

          try {
            await axios.post("http://localhost:5000/api/save-video-metadata", {
              title: file.name,
              description: `Uploaded on ${new Date().toLocaleString()}`,
              videoId,
              thumbnailUrl: "",
            });

            setStatus("✅ Upload and metadata saved!");
            setFile(null);
            alert("Upload complete!");
          } catch (error) {
            setStatus("Metadata save failed.");
            alert("Failed to save metadata: " + error.message);
          } finally {
            setUploading(false);
          }
        },
      });

      uploadRef.current = upload;

      // Resume if previously uploaded chunks exist
      const previousUploads = await upload.findPreviousUploads();
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }

      upload.start();
    } catch (error) {
      setStatus("Upload error.");
      alert("Upload process failed: " + error.message);
      setUploading(false);
    }
  };

  const handlePause = () => {
    if (uploadRef.current && uploading) {
      uploadRef.current.abort();
      setStatus("Paused");
      setUploading(false);
    }
  };

  const handleResume = () => {
    if (uploadRef.current && !uploading) {
      setStatus("Resuming...");
      setUploading(true);
      uploadRef.current.start();
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h2>📤 Upload Large Video (TUS + Bunny)</h2>

      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files[0])}
        disabled={uploading}
        style={{ marginBottom: 12 }}
      />

      <div style={{
        height: 20,
        width: "100%",
        backgroundColor: "#e0e0e0",
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: 8,
      }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            backgroundColor: progress === 100 ? "green" : "#3f51b5",
            transition: "width 0.2s",
          }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <p><strong>Status:</strong> {status}</p>
        <p><strong>Progress:</strong> {progress}%</p>
        <p><strong>Speed:</strong> {speed ? formatBytes(speed) + "/s" : "--"}</p>
        <p><strong>ETA:</strong> {formatTime(eta)}</p>
      </div>

      {!uploading && (
        <button
          onClick={handleUpload}
          disabled={!file}
          style={buttonStyle("#4caf50")}
        >
          Upload Video
        </button>
      )}

      {uploading && (
        <>
          <button onClick={handlePause} style={buttonStyle("#f44336")}>
            Pause
          </button>
          <button onClick={handleResume} style={buttonStyle("#2196f3")}>
            Resume
          </button>
        </>
      )}
    </div>
  );
}

const buttonStyle = (bg) => ({
  padding: "10px 16px",
  marginRight: 8,
  backgroundColor: bg,
  border: "none",
  borderRadius: 4,
  color: "white",
  cursor: "pointer",
});
