/** Isolated manual-verification page. Not imported by the application. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LiveAcousticCheck } from './LiveAcousticCheck';

createRoot(document.getElementById('root')!).render(<StrictMode><LiveAcousticCheck /></StrictMode>);
