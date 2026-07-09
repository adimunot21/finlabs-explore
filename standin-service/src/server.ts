// Entry point. Standalone-runnable: `npm start` boots the stand-in on CONFIG.port.
import { createApp } from './app.js';
import { CONFIG } from './config.js';

const app = createApp();
app.listen(CONFIG.port, CONFIG.host, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[standin] Wayfinder identity stand-in listening on http://${CONFIG.host}:${CONFIG.port}\n` +
      `[standin] validating against:\n` +
      `           - ${CONFIG.specs.accounts}\n` +
      `           - ${CONFIG.specs.keyManagement}\n` +
      `           - ${CONFIG.specs.token}`,
  );
});
