import React, { useEffect, useRef, useState } from 'react';
import Uppy from '@uppy/core';
import XHRUpload from '@uppy/xhr-upload';
import { Dashboard } from '@uppy/react';
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';

function Upload() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const uppyRef = useRef(null);

  useEffect(() => {
    const uppy = new Uppy({
      restrictions: {
        maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB
        allowedFileTypes: ['video/*'],
        maxNumberOfFiles: 1,
      },
      autoProceed: true,
    });

    uppy.use(XHRUpload, {
      endpoint: 'http://localhost:5000/api/upload-url',
      method: 'POST',
      formData: true,
      fieldName: 'file',
      bundle: false,
      getResponseData: (responseText) => {
        const { endpoint } = JSON.parse(responseText);
        return { uploadURL: endpoint };
      },
    });

    uppy.on('upload-progress', (file, progressData) => {
      setProgress(Math.round(progressData.percentage));
    });

    uppy.on('upload-success', () => {
      setStatus('✅ Upload successful!');
    });

    uppy.on('upload-error', (_, error) => {
      setStatus(`❌ Upload failed: ${error}`);
    });

    uppyRef.current = uppy;
    return () => uppy.close();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>Upload to BunnyCDN</h2>
      <Dashboard uppy={uppyRef.current} height={350} />
      {progress > 0 && <p>Progress: {progress}%</p>}
      {status && <p>{status}</p>}
    </div>
  );
}

export default Upload;
