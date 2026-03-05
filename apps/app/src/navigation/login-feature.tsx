import { Feature, SessionManager, useInject } from "@novx/portal";
import React from "react";
import { useNavigate } from "react-router-dom";

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
      await sessionManager.openSession({ username, password });

      const intended = sessionStorage.getItem("intendedRoute") || "/";
      sessionStorage.removeItem("intendedRoute");

      navigate(intended, { replace: true });
    } catch (err: any) {
      setError(err.message || "Login failed");
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "3rem auto", padding: "1.5rem", border: "1px solid #ccc", borderRadius: 8 }}>
      <h2>Login</h2>

      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 12 }}>
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", padding: 6 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 6 }}
          />
        </div>

        {error && (
          <div style={{ color: "red", marginBottom: 10 }}>
            {error}
          </div>
        )}

        <button disabled={loading} style={{ padding: "8px 16px" }}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
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