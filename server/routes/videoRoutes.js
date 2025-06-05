import express from 'express';
import { createVideo } from '../controllers/videoController.js';

const router = express.Router();

router.post('/create', createVideo);

export default router;
