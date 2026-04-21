import React, { useState } from 'react';

function App() {
  const [wallet, setWallet] = useState(null);
  const [candidates, setCandidates] = useState([
    { name: "Alpha", votes: 12 },
    { name: "Beta", votes: 8 },
    { name: "Gamma", votes: 15 }
  ]);
  const [newCandidate, setNewCandidate] = useState("");
  const [loading, setLoading] = useState(false);

  // Pure demo mode - no external wallet library needed
  const connectWallet = () => {
    setWallet("GDEMO...ACCOUNT");
  };

  const castVote = (name) => {
    if (!wallet) {
      alert("Connect wallet first!");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setCandidates(prev => prev.map(c =>
        c.name === name ? { ...c, votes: c.votes + 1 } : c
      ));
      setLoading(false);
    }, 800);
  };

  const addCandidate = () => {
    if (!newCandidate.trim()) return;
    setCandidates(prev => [...prev, { name: newCandidate.trim(), votes: 0 }]);
    setNewCandidate("");
  };

  return (
    <>
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      <header>
        <div className="logo-group">
          <h1>StellarVote</h1>
          <span className="status-badge">Soroban Testnet</span>
        </div>
        <button id="connect-btn" className="btn btn-primary" onClick={connectWallet}>
          {wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Connect Wallet"}
        </button>
      </header>

      <main className="container glass">
        <div style={{ marginBottom: '2rem' }}>
          <h2>Current Polls</h2>
          <p style={{ color: 'var(--text-dim)' }}>
            Cast your vote on the blockchain securely.
          </p>
          {wallet && (
            <p style={{ color: 'var(--accent)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
              ✅ Wallet Connected: {wallet}
            </p>
          )}
        </div>

        <div className="card-grid">
          {candidates.map((cand, idx) => (
            <div key={idx} className="glass candidate-card">
              <h3>{cand.name}</h3>
              <div className="stats">
                <div className="vote-count">{cand.votes}</div>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Votes</div>
              </div>
              <button
                id={`vote-btn-${cand.name.toLowerCase()}`}
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => castVote(cand.name)}
                disabled={loading}
              >
                {loading ? "Processing..." : "Vote Now"}
              </button>
            </div>
          ))}
        </div>

        <div className="admin-section">
          <hr style={{ margin: '3rem 0', opacity: 0.1 }} />
          <h3>Admin Panel</h3>
          <div className="form-group">
            <input
              id="candidate-input"
              type="text"
              placeholder="Candidate Name"
              value={newCandidate}
              onChange={(e) => setNewCandidate(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCandidate()}
            />
            <button id="add-candidate-btn" className="btn btn-primary" onClick={addCandidate}>
              Add Candidate
            </button>
          </div>
        </div>
      </main>

      <footer style={{ marginTop: 'auto', padding: '2rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
        Built with Soroban & React • Level 3 Proof of Work • v2.0.0
      </footer>
    </>
  );
}

export default App;
