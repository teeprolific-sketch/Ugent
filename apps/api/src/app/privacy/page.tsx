export const metadata = { title: 'Privacy policy - Ugent' };

export default function Privacy() {
  return (
    <main>
      <h1>Privacy policy</h1>
      <p className="muted">Ugent by Me AI. Last updated 7 November 2026.</p>

      <h2>What Ugent stores</h2>
      <p>Your tasks, plans, chat messages, energy check-ins and the times you finish tasks are stored on your phone. Ugent works without an internet connection, and none of this leaves your phone unless you use a feature that needs our server.</p>

      <h2>What reaches our server</h2>
      <p><b>Sync.</b> If you sign in, your tasks and plans are copied to our server so they are backed up and available on your other devices and, for Team plans, to your team.</p>
      <p><b>Cloud chat.</b> When you are online, a message you send to Ugent, a few recent messages, and your plans and open tasks for today and tomorrow are sent to our server and to Anthropic, which provides the AI model, to write a reply. When you are offline, chat runs on your phone only.</p>
      <p><b>Subscriptions.</b> Payments are handled by Apple or Google. We receive your plan and its renewal date through RevenueCat, never your card details.</p>

      <h2>What we do not do</h2>
      <p>We do not sell your data, show ads, or use your data to train AI models.</p>

      <h2>Your control</h2>
      <p>In Settings and privacy you can see what Ugent knows about you, turn off learning from your habits, require Ugent to ask before taking any action, copy all your data, and delete your account. Deleting your account removes your data from our server immediately and from backups within 30 days.</p>

      <h2>Contact</h2>
      <p>Questions about privacy: {process.env.PRIVACY_CONTACT_EMAIL ?? 'set PRIVACY_CONTACT_EMAIL on the server'}</p>
    </main>
  );
}
