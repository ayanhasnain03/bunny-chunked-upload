import express from 'express';
import crypto from 'crypto';

const router = express.Router();

router.post('/upload-url', (req, res) => {
  const filename = req.headers['uppy-file-name'];
  if (!filename) return res.status(400).json({ error: 'Missing filename' });

  const zone = process.env.BUNNY_STORAGE_ZONE;
  const accessKey = process.env.BUNNY_ACCESS_KEY;
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const path = `/${zone}/${Date.now()}-${filename}`;
  const token = crypto.createHmac('sha256', accessKey).update(path + expires).digest('hex');
  const signedUrl = `https://storage.bunnycdn.com${path}?token=${token}&expires=${expires}`;

  return res.json({ endpoint: signedUrl });
});

export default router;
