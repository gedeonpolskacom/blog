type LoginPageProps = {
  searchParams: Promise<{
    from?: string;
    error?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const from = params.from?.startsWith('/') ? params.from : '/admin';
  const hasError = params.error === '1';

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: 'var(--color-black)',
      fontFamily: 'var(--font-body)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--color-black-card)',
        border: '1px solid var(--glass-border)',
        borderRadius: '18px',
        padding: '2rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ color: 'var(--color-cream)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Panel admina
          </h1>
          <p style={{ color: 'var(--color-gray-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Zaloguj się tokenem administracyjnym, aby przejść do zarządzania treściami.
          </p>
        </div>

        <form action="/admin/login/submit" method="POST" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input type="hidden" name="from" value={from} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <span style={{ color: 'var(--color-cream)', fontSize: '0.85rem', fontWeight: 600 }}>
              Token
            </span>
            <input
              name="token"
              type="password"
              required
              autoFocus
              className="newsletter-input"
              placeholder="Wpisz ADMIN_TOKEN"
            />
          </label>

          {hasError && (
            <p style={{
              margin: 0,
              color: '#ef4444',
              fontSize: '0.84rem',
            }}>
              Nieprawidłowy token. Spróbuj ponownie.
            </p>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ justifyContent: 'center', padding: '0.8rem 1rem' }}
          >
            Zaloguj
          </button>
        </form>
      </div>
    </main>
  );
}

