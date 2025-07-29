
import { config } from 'dotenv';
config();

// Increase the max listeners to potentially avoid MaxListenersExceededWarning in dev watch mode
if (typeof process !== 'undefined' && process.setMaxListeners) {
  process.setMaxListeners(20); // Default is 10, setting higher for dev convenience
}

// No default flows are imported currently.
// If you add Genkit flows, import them here.
// e.g., import '@/server/ai/flows/your-flow-name.ts';
