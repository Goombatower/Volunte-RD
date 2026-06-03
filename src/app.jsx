import { useState, useEffect, useCallback } from "react";
import "./App.css";
 
const API = "http://localhost:3001/api";
 

function LoginModal({ onClose, onGoRegister, onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
 
  async function handleLogin() {
    setError(""); setLoading(true);
    try {
      const res  = await fetch(`${API}/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onLoginSuccess(username); onClose();
    } catch { setError("Could not reach the server."); }
    finally   { setLoading(false); }
  }
 
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">Welcome Back</h2>
        {error && <p className="form-error">{error}</p>}
        <div className="input-group">
          <label>Username</label>
          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Password</label>
          <input type="password" placeholder="••••••••" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
        </div>
        <button className="btn-primary" onClick={handleLogin} disabled={loading}>
          {loading ? "Logging in…" : "Log In"}
        </button>
        <p className="modal-footer-text">
          No Account?{" "}
          <span className="register-link" onClick={() => { onClose(); onGoRegister(); }}>Register here.</span>
        </p>
      </div>
    </div>
  );
}
 
// ── REGISTER PAGE ─────────────────────────────────────────
function RegisterPage({ onBack }) {
  const [username,  setUsername]  = useState("");
  const [password,  setPassword]  = useState("");
  const [password2, setPassword2] = useState("");
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState("");
  const [loading,   setLoading]   = useState(false);
 
  async function handleRegister() {
    setError(""); setSuccess("");
    if (password !== password2) { setError("Passwords do not match."); return; }
    if (password.length < 6)    { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API}/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess("Account created! You can now log in.");
      setUsername(""); setPassword(""); setPassword2("");
    } catch { setError("Could not reach the server."); }
    finally   { setLoading(false); }
  }
 
  return (
    <div className="register-page">
      <div className="register-card">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2 className="register-title">Create Your Account</h2>
        {error   && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}
        <div className="input-group">
          <label>Username</label>
          <input type="text" placeholder="James Doe" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Password</label>
          <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Repeat Password</label>
          <input type="password" placeholder="••••••••" value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRegister()} />
        </div>
        <button className="btn-primary" onClick={handleRegister} disabled={loading}>
          {loading ? "Creating account…" : "Create Account"}
        </button>
        <p className="modal-footer-text">
          Already have an account?{" "}
          <span className="register-link" onClick={onBack}>Log in.</span>
        </p>
      </div>
    </div>
  );
}
 
// ── NEW POST MODAL ────────────────────────────────────────
function NewPostModal({ onClose, currentUser, onPostCreated }) {
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [startDate,   setStartDate]   = useState("");
  const [tagInput,    setTagInput]    = useState("");
  const [tags,        setTags]        = useState([]);
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
 
  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }
  function removeTag(t) { setTags(tags.filter((x) => x !== t)); }
 
  async function handleSubmit() {
    setError("");
    if (!title || !description || !startDate) { setError("All fields are required."); return; }
    if (description.length > 200) { setError("Description must be 200 characters or fewer."); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API}/postings`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posting_title:       title,
          posting_tags:        tags,
          posting_start_date:  startDate,
          posting_description: description,
          author_username:     currentUser,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onPostCreated(data);
      onClose();
    } catch { setError("Could not reach the server."); }
    finally   { setLoading(false); }
  }
 
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--wide" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">Create a Posting</h2>
        {error && <p className="form-error">{error}</p>}
 
        <div className="input-group">
          <label>Title</label>
          <input type="text" placeholder="e.g. Beach Clean-Up Drive" maxLength={100}
            value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
 
        <div className="input-group">
          <label>Description <span className="char-count">({description.length}/200)</span></label>
          <textarea placeholder="Describe the opportunity…" maxLength={200} rows={3}
            value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
 
        <div className="input-group">
          <label>Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
 
        <div className="input-group">
          <label>Tags</label>
          <div className="tag-input-row">
            <input type="text" placeholder="e.g. Environment" value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }} />
            <button className="btn-tag-add" onClick={addTag}>Add</button>
          </div>
          {tags.length > 0 && (
            <div className="tag-list">
              {tags.map((t) => (
                <span key={t} className="tag tag--removable">
                  {t} <button onClick={() => removeTag(t)}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
 
        <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "Posting…" : "Post Opportunity"}
        </button>
      </div>
    </div>
  );
}
 
// ── POST CARD ─────────────────────────────────────────────
function PostCard({ post }) {
  const date = new Date(post.posting_start_date).toLocaleDateString("en-CA", {
    year: "numeric", month: "long", day: "numeric",
  });
 
  return (
    <div className="post-card">
      <div className="post-card__header">
        <div>
          <h2 className="post-card__title">{post.posting_title}</h2>
          <p className="post-card__meta">Posted by <strong>{post.author_username}</strong></p>
        </div>
        <div className="post-card__date">
          <span className="post-card__date-label">Starts</span>
          <span className="post-card__date-value">{date}</span>
        </div>
      </div>
 
      {post.posting_tags.length > 0 && (
        <div className="tag-list tag-list--card">
          {post.posting_tags.map((t) => <span key={t} className="tag">{t}</span>)}
        </div>
      )}
 
      <p className="post-card__desc">{post.posting_description}</p>
    </div>
  );
}
 
// ── MAIN APP ──────────────────────────────────────────────
export default function App() {
  const [currentUser,  setCurrentUser]  = useState(null);
  const [scrolled,     setScrolled]     = useState(false);
  const [showLogin,    setShowLogin]    = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showNewPost,  setShowNewPost]  = useState(false);
 
  const [posts,        setPosts]        = useState([]);
  const [search,       setSearch]       = useState("");
  const [loadingPosts, setLoadingPosts] = useState(false);
 
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
 
  const fetchPosts = useCallback(async (q = "") => {
    setLoadingPosts(true);
    try {
      const url = q ? `${API}/postings?search=${encodeURIComponent(q)}` : `${API}/postings`;
      const res = await fetch(url);
      const data = await res.json();
      setPosts(data);
    } catch { /* silent */ }
    finally { setLoadingPosts(false); }
  }, []);
 
  useEffect(() => { fetchPosts(); }, [fetchPosts]);
 
  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => fetchPosts(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchPosts]);
 
  return (
    <div className="app">
      {/* ── NAVBAR ── */}
      <header className={`navbar ${scrolled ? "navbar--scrolled" : ""}`}>
        <span className="navbar-logo">Volunte-RD</span>
        {currentUser ? (
          <div className="navbar-user">
            <span className="navbar-username">👤 {currentUser}</span>
            <button className="navbar-logout-btn" onClick={() => setCurrentUser(null)}>Log out</button>
          </div>
        ) : (
          <button className="navbar-login-btn" onClick={() => setShowLogin(true)}>Log-in</button>
        )}
      </header>
 
      {/* ── MODALS ── */}
      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)}
          onGoRegister={() => setShowRegister(true)}
          onLoginSuccess={(u) => setCurrentUser(u)} />
      )}
      {showRegister && <RegisterPage onBack={() => setShowRegister(false)} />}
      {showNewPost && (
        <NewPostModal onClose={() => setShowNewPost(false)}
          currentUser={currentUser}
          onPostCreated={(p) => setPosts((prev) => [p, ...prev])} />
      )}
 
      {/* ── MAIN ── */}
      <main className="feed-main">
 
        {/* Search bar row */}
        <div className="feed-toolbar">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by title or tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button className="search-clear" onClick={() => setSearch("")}>✕</button>}
          </div>
          {currentUser && (
            <button className="btn-new-post" onClick={() => setShowNewPost(true)}>
              + New Posting
            </button>
          )}
        </div>
 
        {/* Post feed */}
        {loadingPosts ? (
          <p className="feed-status">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="feed-status">
            {search ? "No postings match your search." : "No postings yet. Be the first to post!"}
          </p>
        ) : (
          <div className="feed-list">
            {posts.map((p) => <PostCard key={p.posting_id} post={p} />)}
          </div>
        )}
      </main>
    </div>
  );
}
 
