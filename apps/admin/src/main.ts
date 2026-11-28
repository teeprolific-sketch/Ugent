/* Entry point. The real build talks to the admin API over HTTPS; the demo build uses the pretend server in demo.ts. */
import { httpTransport, Session } from './api';
import { startApp } from './app';

declare const __DEMO__: boolean;
declare const __API_URL__: string;

async function main() {
  const root = document.getElementById('root')!;
  const layer = document.getElementById('layer')!;
  if (__DEMO__) {
    const { demoTransport, DEMO_KEYS } = await import('./demo');
    // A fresh pretend server each load, so a saved session from an earlier visit can't be valid.
    const session = new Session(demoTransport());
    session.set(null);
    startApp(root, layer, { session, demo: true, demoKeys: DEMO_KEYS });
  } else {
    startApp(root, layer, { session: new Session(httpTransport(__API_URL__ || location.origin)), demo: false });
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main); else main();
