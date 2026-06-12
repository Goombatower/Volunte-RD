import { useState, useEffect, useCallback } from "react";
import "./app.css";

const API = "https://volunte-rd-production.up.railway.app/api";

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
      onLoginSuccess(username, data.userId, data.organizer, data.admin);
      onClose();
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

function NewPostModal({ onClose, currentUser, currentUserId, onPostCreated }) {
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [startDate,   setStartDate]   = useState("");
  const [tagInput,    setTagInput]    = useState("");
  const [tags,        setTags]        = useState([]);
  const [maxHelpers,  setMaxHelpers]  = useState(1);
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
    if (maxHelpers < 1) { setError("You need at least 1 helper spot."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/postings`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, tags, start_date: startDate,
          description, author: currentUserId,
          max_helpers: parseInt(maxHelpers),
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
          <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Helpers Needed</label>
          <input type="number" min={1} max={999} placeholder="e.g. 10"
            value={maxHelpers} onChange={(e) => setMaxHelpers(e.target.value)} />
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

function PostCard({ post, currentUserId, isOrganizer, isAdmin, onJoined }) {
  const [joining,   setJoining]   = useState(false);
  const [joinError, setJoinError] = useState("");

  const date = new Date(post.start_date).toLocaleDateString("en-CA", {
    year: "numeric", month: "long", day: "numeric",
  });

  const helperCount = post.helpers ? post.helpers.length : 0;
  const maxHelpers  = post.max_helpers || 0;
  const isFull      = maxHelpers > 0 && helperCount >= maxHelpers;
  const hasJoined   = currentUserId && post.helpers && post.helpers.includes(currentUserId);

  const canJoin = currentUserId && !isOrganizer && !isAdmin;
  const canDelete = currentUserId && (post.author_id === currentUserId || isAdmin);
  const displayAuthor = post.author_username || post.author;

  async function handleJoin() {
    setJoinError(""); setJoining(true);
    try {
      const res  = await fetch(`${API}/postings/${post.id}/join`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      });
      const data = await res.json();
      if (!res.ok) { setJoinError(data.error); return; }
      onJoined(data); 
    } catch { setJoinError("Could not reach the server."); }
    finally   { setJoining(false); }
  }

  async function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this posting?")) return;
    setDeleting(true);
    try {
      const res  = await fetch(`${API}/postings/${post.id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      onDeleted(post.id);
    } catch { alert("Could not reach the server."); }
    finally   { setDeleting(false); }
  }

  return (
    <div className="post-card">
      <div className="post-card__header">
        <div>
          <h2 className="post-card__title">{post.title}</h2>
          <p className="post-card__meta">Posted by <strong>{displayAuthor}</strong></p>
        </div>
        <div className="post-card__date">
          <span className="post-card__date-label">Starts</span>
          <span className="post-card__date-value">{date}</span>
        </div>
      </div>

      {post.tags && post.tags.length > 0 && (
        <div className="tag-list tag-list--card">
          {post.tags.map((t) => <span key={t} className="tag">{t}</span>)}
        </div>
      )}

      <p className="post-card__desc">{post.description}</p>

      <div className="post-card__footer">
        <span className={`helper-pill ${isFull ? "helper-pill--full" : ""}`}>
          👥 {helperCount} / {maxHelpers} helpers
        </span>

        {canJoin && (
          <div className="join-area">
            {joinError && <span className="join-error">{joinError}</span>}
            {hasJoined ? (
              <span className="joined-badge">✓ Joined</span>
            ) : (
              <button
                className={`btn-join ${isFull ? "btn-join--disabled" : ""}`}
                onClick={handleJoin}
                disabled={joining || isFull}
              >
                {joining ? "Joining…" : isFull ? "Full" : "Join as Helper"}
              </button>
            )}
          </div>
        )}

        {canDelete && (
            <button className="btn-delete" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "🗑 Delete"}
            </button>
          )}

      </div>
    </div>
  );
}

export default function App() {
  const [currentUser,  setCurrentUser]  = useState(null);
  const [currentUserId,setCurrentUserId]= useState(null);
  const [isOrganizer,  setIsOrganizer]  = useState(false);
  const [isAdmin,      setIsAdmin]      = useState(false);
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
  useEffect(() => {
    const t = setTimeout(() => fetchPosts(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchPosts]);

  function handleLoginSuccess(username, userId, organizer, admin) {
    setCurrentUser(username);
    setCurrentUserId(userId);
    setIsOrganizer(organizer);
    setIsAdmin(admin);
  }

  function handleLogout() {
    setCurrentUser(null);
    setCurrentUserId(null);
    setIsOrganizer(false);
    setIsAdmin(false);
  }

  function handlePostJoined(updatedPost) {
    setPosts((prev) => prev.map((p) => p.id === updatedPost.id ? updatedPost : p));
  }

  return (
    <div className="app">
      <header className={`navbar ${scrolled ? "navbar--scrolled" : ""}`}>
        <span className="navbar-logo">Volunte-RD</span>
        {currentUser ? (
          <div className="navbar-user">
            <span className="navbar-username">
              {currentUser}
              {isOrganizer && <span className="organizer-badge">Organizer</span>}
              {isAdmin      && <span className="organizer-badge admin-badge">Admin</span>}
            </span>
            <button className="navbar-logout-btn" onClick={handleLogout}>Log out</button>
          </div>
        ) : (
          <button className="navbar-login-btn" onClick={() => setShowLogin(true)}>Log-in</button>
        )}
      </header>

      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)}
          onGoRegister={() => setShowRegister(true)}
          onLoginSuccess={handleLoginSuccess} />
      )}
      {showRegister && <RegisterPage onBack={() => setShowRegister(false)} />}
      {showNewPost && (
        <NewPostModal onClose={() => setShowNewPost(false)}
          currentUser={currentUser}
          onPostCreated={(p) => setPosts((prev) => [p, ...prev])} />
      )}

      <main className="feed-main">
        <div className="feed-toolbar">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Search by title or tag…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button className="search-clear" onClick={() => setSearch("")}>✕</button>}
          </div>
          {currentUser && isOrganizer && (
            <button className="btn-new-post" onClick={() => setShowNewPost(true)}>
              + New Opportunity
            </button>
          )}
        </div>

        {loadingPosts ? (
          <p className="feed-status">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="feed-status">
            {search ? "No postings match your search." : "No postings yet. Be the first to post!"}
          </p>
        ) : (
          <div className="feed-list">
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                currentUserId={currentUserId}
                isOrganizer={isOrganizer}
                isAdmin={isAdmin}
                onJoined={handlePostJoined}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}