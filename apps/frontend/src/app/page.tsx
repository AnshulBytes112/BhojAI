import { Message } from '@bhojai/api-interfaces';

export default async function Index() {
  let welcomeMessage;
  try {
    const res = await fetch('http://localhost:3333/api', { cache: 'no-store' });
    welcomeMessage = (await res.json()) as Message;
  } catch (e) {
    welcomeMessage = { message: 'Failed to fetch from API' };
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>BhojAI Monorepo</h1>
      <p>Frontend (Next.js) + Backend (Express)</p>
      <div style={{ marginTop: '2rem', border: '1px solid #ccc', padding: '1rem' }}>
        <h2>API Response:</h2>
        <pre>{JSON.stringify(welcomeMessage, null, 2)}</pre>
      </div>
    </div>
  );
}
