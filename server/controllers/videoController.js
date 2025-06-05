import axios from 'axios';
import Video from '../models/Video.js';

export const createVideo = async (req, res) => {
  try {
    const { title } = req.body;

    // Create Bunny video metadata
    const createRes = await axios.post(
      `https://video.bunnycdn.com/library/${process.env.BUNNY_STREAM_LIBRARY_ID}/videos`,
      { title },
      {
        headers: {
          AccessKey: process.env.BUNNY_STREAM_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    const { guid } = createRes.data;
    const uploadUrl = `https://video.bunnycdn.com/library/${process.env.BUNNY_STREAM_LIBRARY_ID}/videos/${guid}`;
    const playbackUrl = `https://vz-${process.env.BUNNY_STREAM_LIBRARY_ID}-${guid}.b-cdn.net/play.m3u8`;

    // Save video metadata in MongoDB
    const video = new Video({ title, guid, playbackUrl });
    await video.save();

    res.json({ guid, uploadUrl, playbackUrl });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create video' });
  }
};
