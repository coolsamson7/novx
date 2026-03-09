import { Feature, SessionManager, useInject } from "@novx/portal";
import React from "react";
import { useNavigate } from "react-router-dom";

/* ---------------------------
   Styles
--------------------------- */

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

  .login-root {
    min-height: 100vh;
    height: 100vh;
    display: flex;
    font-family: 'DM Sans', sans-serif;
    background: #ffffff;
  }

  /* ---- Left panel ---- */

  .login-panel-left {
    flex: 1;
    background: linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 3.5rem;
    position: relative;
    overflow: hidden;
  }

  .login-panel-left::before {
    content: '';
    position: absolute;
    top: -80px; right: -80px;
    width: 320px; height: 320px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
    pointer-events: none;
  }

  .login-panel-left::after {
    content: '';
    position: absolute;
    bottom: 60px; left: -60px;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: rgba(255,255,255,0.04);
    pointer-events: none;
  }

  .login-panel-tagline {
    position: relative;
    z-index: 1;
  }

  .login-panel-eyebrow {
    font-size: 0.68rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.45);
    margin-bottom: 1rem;
    font-weight: 500;
  }

  .login-panel-tagline h2 {
    font-family: 'DM Serif Display', serif;
    font-size: 3rem;
    font-weight: 400;
    color: #ffffff;
    line-height: 1.1;
    margin: 0 0 1.25rem;
  }

  .login-panel-tagline h2 em {
    font-style: italic;
    color: rgba(255,255,255,0.7);
  }

  .login-panel-tagline p {
    font-size: 0.875rem;
    color: rgba(255,255,255,0.5);
    font-weight: 300;
    line-height: 1.7;
    max-width: 320px;
  }

  /* ---- Right panel ---- */

  .login-panel-right {
    width: 460px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2.5rem;
    background: #ffffff;
    border-left: 1px solid #f3f4f6;
  }

  @media (max-width: 720px) {
    .login-panel-left { display: none; }
    .login-panel-right { width: 100%; border-left: none; }
  }

  /* ---- Card ---- */

  .login-card {
    position: relative;
    width: 100%;
    max-width: 360px;
    animation: cardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  /* ---- Wordmark ---- */

  .login-wordmark {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 2.5rem;
  }

  .login-wordmark-icon {
    width: 28px; height: 28px;
    border: 1.5px solid #2563eb;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .login-wordmark-icon::after {
    content: '';
    width: 8px; height: 8px;
    background: #2563eb;
    border-radius: 50%;
  }

  .login-wordmark-text {
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #6b7280;
    font-weight: 500;
  }

  /* ---- Heading ---- */

  .login-heading {
    font-family: 'DM Serif Display', serif;
    font-size: 2.25rem;
    font-weight: 400;
    color: #111827;
    line-height: 1.1;
    margin: 0 0 0.4rem;
    letter-spacing: -0.01em;
  }

  .login-heading em {
    font-style: italic;
    color: #2563eb;
  }

  .login-subtext {
    font-size: 0.85rem;
    color: #6b7280;
    margin: 0 0 2.25rem;
    font-weight: 300;
  }

  /* ---- Fields ---- */

  .login-field {
    margin-bottom: 1.25rem;
    animation: fieldIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .login-field:nth-child(1) { animation-delay: 0.08s; }
  .login-field:nth-child(2) { animation-delay: 0.15s; }

  .login-label {
    display: block;
    font-size: 0.78rem;
    color: #374151;
    margin-bottom: 0.4rem;
    font-weight: 500;
  }

  .login-input-wrap {
    position: relative;
  }

  .login-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.7rem 0.9rem;
    background: #f9fafb;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    color: #111827;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem;
    font-weight: 400;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    -webkit-appearance: none;
  }

  .login-input::placeholder { color: #9ca3af; }

  .login-input:focus {
    border-color: #2563eb;
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
  }

  .login-input:focus + .login-input-line {
    transform: scaleX(1);
  }

  .login-input-line {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
    background: #2563eb;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    border-radius: 0 0 6px 6px;
  }

  /* ---- Error ---- */

  .login-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 0.9rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    margin-bottom: 1.25rem;
    font-size: 0.82rem;
    color: #dc2626;
    font-weight: 400;
    animation: shake 0.35s ease both;
  }

  .login-error-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: #dc2626;
    flex-shrink: 0;
  }

  /* ---- Button ---- */

  .login-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    margin-top: 0.25rem;
    background: #2563eb;
    border: none;
    border-radius: 6px;
    color: #ffffff;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
    box-shadow: 0 1px 3px rgba(37,99,235,0.3);
  }

  .login-btn:hover:not(:disabled) {
    background: #1d4ed8;
    box-shadow: 0 4px 12px rgba(37,99,235,0.35);
    transform: translateY(-1px);
  }

  .login-btn:active:not(:disabled) {
    background: #1e40af;
    transform: translateY(0);
    box-shadow: none;
  }

  .login-btn:disabled {
    background: #93c5fd;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  .login-btn-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .login-spinner {
    width: 12px; height: 12px;
    border: 1.5px solid rgba(255,255,255,0.35);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  /* ---- Footer ---- */

  .login-footer {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #f3f4f6;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .login-footer-line {
    font-size: 0.7rem;
    color: #9ca3af;
    letter-spacing: 0.04em;
  }

  .login-footer-dots { display: flex; gap: 4px; }

  .login-footer-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: #e5e7eb;
  }

  .login-footer-dot:first-child { background: #2563eb; }

  /* ---- Animations ---- */

  @keyframes cardIn {
    from { opacity: 0; transform: translateY(16px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes fieldIn {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-5px); }
    60%       { transform: translateX(5px); }
    80%       { transform: translateX(-3px); }
  }
`;

/* ---------------------------
   Functional view
--------------------------- */

const LoginView: React.FC = () => {
  const [sessionManager] = useInject(SessionManager);
  const navigate = useNavigate();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await sessionManager.openSession({ user: username, password });
      const intended = sessionStorage.getItem("intendedRoute") || "/";
      sessionStorage.removeItem("intendedRoute");
      navigate(intended, { replace: true });
    } catch (err: any) {
      setError(err.message || "Login failed");
      setLoading(false);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="login-root">

        {/* Left branding panel */}
        <div className="login-panel-left">
          <div className="login-panel-tagline">
            <p className="login-panel-eyebrow">Novx Portal</p>
            <h2>Your workspace,<br /><em>one place.</em></h2>
            <p>Manage your projects, collaborate with your team, and stay on top of everything that matters.</p>
          </div>
        </div>

        {/* Right login panel */}
        <div className="login-panel-right">
          <div className="login-card">

            <div className="login-wordmark">
              <div className="login-wordmark-icon" />
              <span className="login-wordmark-text">Novx Portal</span>
            </div>

            <h1 className="login-heading">
              Welcome<br /><em>back.</em>
            </h1>
            <p className="login-subtext">Sign in to continue to your workspace.</p>

            <form onSubmit={handleLogin} noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="username">Username</label>
                <div className="login-input-wrap">
                  <input
                    id="username"
                    className="login-input"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="username"
                    spellCheck={false}
                  />
                  <div className="login-input-line" />
                </div>
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="password">Password</label>
                <div className="login-input-wrap">
                  <input
                    id="password"
                    className="login-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    autoComplete="current-password"
                  />
                  <div className="login-input-line" />
                </div>
              </div>

              {error && (
                <div className="login-error" key={error}>
                  <div className="login-error-dot" />
                  {error}
                </div>
              )}

              <button className="login-btn" type="submit" disabled={loading}>
                <span className="login-btn-inner">
                  {loading && <span className="login-spinner" />}
                  {loading ? "Authenticating…" : "Sign in"}
                </span>
              </button>
            </form>

            <div className="login-footer">
              <span className="login-footer-line">Secured · Encrypted</span>
              <div className="login-footer-dots">
                <div className="login-footer-dot" />
                <div className="login-footer-dot" />
                <div className="login-footer-dot" />
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
};

/* ---------------------------
   Feature component
--------------------------- */

@Feature({
  id: "login",
  path: "/login",
  tags: ["login"],
  visibility: ["public"]
})
export class LoginPage extends React.Component {
  render() {
    return <LoginView />;
  }
}