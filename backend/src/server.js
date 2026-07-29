import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { ensureInitialAdmin } from './services/adminSeedService.js';
import { startMailWorker } from './services/mailWorker.js';

try {
  await connectDatabase();
  await ensureInitialAdmin();
  startMailWorker();
  createApp().listen(env.PORT, () => console.log(`GEU Induction Connect API listening on ${env.PORT}`));
} catch (error) {
  console.error('Unable to start API:', error.message);
  process.exit(1);
}
