import React from "react";
import { Feature } from "@novx/portal";
import { useNavigate, useParams, Outlet } from "react-router-dom";

// ─────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────

const USERS = [
  { id: 1, name: "John Doe",       role: "Admin",   status: "Active"   },
  { id: 2, name: "Jane Smith",     role: "User",    status: "Active"   },
  { id: 3, name: "Bob Johnson",    role: "User",    status: "Inactive" },
  { id: 4, name: "Alice Brown",    role: "Manager", status: "Active"   },
  { id: 5, name: "Charlie Wilson", role: "User",    status: "Pending"  },
];

type User = typeof USERS[0];

// ─────────────────────────────────────────────
// PARENT — /users
// ─────────────────────────────────────────────

function UserListContent() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#111", color: "#e0e0e0", fontFamily: "sans-serif" }}>

      {/* Left: name list */}
      <div style={{ width: "220px", borderRight: "1px solid #2a2a2a", overflowY: "auto" }}>
        <div style={{ padding: "16px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", color: "#666", textTransform: "uppercase" }}>
          Users
        </div>
        {USERS.map(user => (
          <div
            key={user.id}
            onClick={() => navigate(String(user.id))}
            style={{
              padding: "10px 16px",
              cursor: "pointer",
              fontSize: "14px",
              backgroundColor: userId === String(user.id) ? "#1e1e2e" : "transparent",
              borderLeft: userId === String(user.id) ? "2px solid #3b82f6" : "2px solid transparent",
              color: userId === String(user.id) ? "#fff" : "#a0a0a0",
            }}
          >
            {user.name}
          </div>
        ))}
      </div>

      {/* Right: child route renders here */}
      <div style={{ flex: 1, padding: "32px" }}>
        <Outlet />
      </div>

    </div>
  );
}

@Feature({
  id: "users",
  parent: "showcases",
  label: "Users",
  path: "/users",
  tags: ["showcase"],
  visibility: ["public"],
})
export class UserList extends React.Component {
  render() { return <UserListContent />; }
}

// ─────────────────────────────────────────────
// CHILD — /users/:userId
// ─────────────────────────────────────────────

function UserDetailContent() {
  const { userId } = useParams<{ userId: string }>();
  const user = USERS.find(u => u.id === parseInt(userId ?? "0"));

  if (!user) return <p style={{ color: "#444", fontSize: "14px" }}>User not found.</p>;

  return (
    <>
      <h2 style={{ margin: "0 0 8px 0", fontSize: "22px", fontWeight: 700, color: "#fff" }}>{user.name}</h2>
      <p style={{ margin: "0 0 24px 0", fontSize: "13px", color: "#555" }}>#{user.id}</p>
      <Row label="Role"   value={user.role} />
      <Row label="Status" value={user.status} />
    </>
  );
}

@Feature({
  id: "user-detail",
  label: "User Detail",
  path: ":userId",
  parent: "users",
  visibility: ["public"],
})
export class UserDetail extends React.Component {
  render() { return <UserDetailContent />; }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ fontSize: "11px", color: "#555", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: "14px", color: "#ccc" }}>{value}</div>
    </div>
  );
}