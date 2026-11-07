import Image from 'next/image';

export default function Home() {
  return (
    <main>
      <Image src="/ugent-wordmark.svg" alt="Ugent" width={180} height={73} priority />
      <h1>Your day, handled.</h1>
      <p>Ugent is a personal AI agent for real African life. It plans around traffic, power cuts and family, works offline, speaks English, Pidgin, Yoruba, Igbo, Hausa and French, and takes real action for you.</p>
      <p className="muted">This server powers the Ugent app. <a href="/privacy">Privacy policy</a></p>
    </main>
  );
}
