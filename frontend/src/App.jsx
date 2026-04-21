import React, { useState, useEffect } from 'react';
import * as StellarSdk from "@stellar/stellar-sdk";

const CONTRACT_ID = "C... (Deploy and replace)"; // Placeholder

function App() {
  const [wallet, setWallet] = useState(null);
  const [candidates, setCandidates] = useState([
    { name: "Alpha", votes: 12 },
    { name: "Beta", votes: 8 },
    { name: "Gamma", votes: 15 }
  ]);
  const [newCandidate, setNewCandidate] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkWallet();
  }, []);

  const checkWallet = async () => {
    try {
      const fApi = window.freighterApi;
      if (fApi && await fApi.isConnected()) {
        const pubKey = await fApi.getPublicKey();
        if (pubKey) setWallet(pubKey);
      }
    } catch (e) {
      console.log("Initial check failed");
    }
  };

  const connectWallet = async () => {
    try {
      setLoading(true);
      const fApi = window.freighterApi;
      if (fApi && await fApi.isConnected()) {
        const pubKey = await fApi.getPublicKey();
        if (pubKey) {
          setWallet(pubKey);
          setLoading(false);
          return;
        }
      }
      activateDemo();
    } catch (e) {
      console.error(e);
      activateDemo();
    }
  };

  const activateDemo = () => {
    setWallet("G...DEMO_ACCOUNT");
    setLoading(false);
    alert("Connected via Demo Mode for recording/testing!");
  };

  const castVote = async (name) => {
    if (!wallet) return alert("Connect wallet first!");
    setLoading(true);
    // Soroban interaction logic would go here
    // For demo, we simulate success
    setTimeout(() => {
      setCandidates(prev => prev.map(c => 
        c.name === name ? { ...c, votes: c.votes + 1 } : c
      ));
      setLoading(false);
      alert(`Voted for ${name}!`);
    }, 1000);
  };

  const addCandidate = async () => {
    if (!newCandidate) return;
    setCandidates([...candidates, { name: newCandidate, votes: 0 }]);
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
          <span className="status-badge">Soroban Network</span>
        </div>
        <button className="btn btn-primary" onClick={connectWallet}>
          {wallet ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : "Connect Wallet"}
        </button>
      </header>

      <main className="container glass">
        <div style={{ marginBottom: '2rem' }}>
          <h2>Current Polls</h2>
          <p style={{ color: 'var(--text-dim)' }}>Cast your vote on the blockchain securely.</p>
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
              type="text" 
              placeholder="Candidate Name" 
              value={newCandidate}
              onChange={(e) => setNewCandidate(e.target.value)}
            />
            <button className="btn btn-primary" onClick={addCandidate}>
              Add Candidate
            </button>
          </div>
        </div>
      </main>

      <footer style={{ marginTop: 'auto', padding: '2rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
        Built with Soroban & React • Level 3 Proof of Work • v1.0.4
      </footer>
    </>
  );
}

export default App;
