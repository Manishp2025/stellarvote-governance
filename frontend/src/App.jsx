import React, { useState, useEffect } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';
import { isConnected, getPublicKey, signTransaction } from '@stellar/freighter-api';

// --- CONFIGURATION ---
const CONTRACT_ID = "CC6O7XG7K6Y7ZJ2V3W5XYG6Y7ZJ2V3W5XYG6Y7ZJ2V3W5XYG6Y7ZJ2V3W"; // PLACEHOLDER: Replace with your actual Contract ID
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

const server = new StellarSdk.rpc.Server(RPC_URL);

// --- ERROR BOUNDARY COMPONENT ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(_error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error("Uncaught error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="status-toast error" style={{ margin: '2rem' }}>
          <h2>Something went wrong.</h2>
          <p>Please refresh the page or contact support.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [wallet, setWallet] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [rewardBalance, setRewardBalance] = useState(0);
  const [newCandidate, setNewCandidate] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // --- CONFIG ---
  // In a real app, these would be in .env
  const TOKEN_CONTRACT_ID = "CD...REWARD_TOKEN_ID"; // Placeholder

  useEffect(() => {
    const checkWallet = async () => {
      if (await isConnected()) {
        const publicKey = await getPublicKey();
        if (publicKey) {
          setWallet(publicKey);
          fetchRewards(publicKey);
        }
      }
    };

    const cachedCandidates = localStorage.getItem("stellarVote_candidates");
    if (cachedCandidates) {
      try { setCandidates(JSON.parse(cachedCandidates)); } catch (e) {}
    }

    checkWallet();
    fetchCandidates();

    // Real-time Event Polling (Advanced Streaming)
    const interval = setInterval(() => {
      if (!loading) fetchCandidates();
      if (wallet) fetchRewards(wallet);
    }, 5000);

    return () => clearInterval(interval);
  }, [wallet]);

  const fetchCandidates = async () => {
    try {
      const contract = new StellarSdk.Contract(CONTRACT_ID);
      const tx = new StellarSdk.TransactionBuilder(
        new StellarSdk.Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAAAAAAAAAA", "0"),
        { fee: "100", networkPassphrase: NETWORK_PASSPHRASE }
      )
        .addOperation(contract.call("list_candidates"))
        .setTimeout(0)
        .build();

      const result = await server.simulateTransaction(tx);
      if (StellarSdk.rpc.Api.isSimulationSuccess(result)) {
        const candidateNames = StellarSdk.scValToNative(result.result.retval);
        const candidatesWithVotes = await Promise.all(candidateNames.map(async (name) => {
          const voteTx = new StellarSdk.TransactionBuilder(
            new StellarSdk.Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAAAAAAAAAA", "0"),
            { fee: "100", networkPassphrase: NETWORK_PASSPHRASE }
          )
            .addOperation(contract.call("get_votes", StellarSdk.nativeToScVal(name, { type: "symbol" })))
            .setTimeout(0)
            .build();
          const voteRes = await server.simulateTransaction(voteTx);
          const votes = StellarSdk.scValToNative(voteRes.result.retval);
          return { name, votes: Number(votes) };
        }));
        setCandidates(candidatesWithVotes);
        localStorage.setItem("stellarVote_candidates", JSON.stringify(candidatesWithVotes));
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const fetchRewards = async (userAddress) => {
    try {
      if (!TOKEN_CONTRACT_ID.startsWith("CD")) return; // Skip if placeholder
      const contract = new StellarSdk.Contract(TOKEN_CONTRACT_ID);
      const tx = new StellarSdk.TransactionBuilder(
        new StellarSdk.Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAAAAAAAAAA", "0"),
        { fee: "100", networkPassphrase: NETWORK_PASSPHRASE }
      )
        .addOperation(contract.call("balance_of", StellarSdk.nativeToScVal(userAddress, { type: "address" })))
        .setTimeout(0)
        .build();
      const result = await server.simulateTransaction(tx);
      if (StellarSdk.rpc.Api.isSimulationSuccess(result)) {
        setRewardBalance(Number(StellarSdk.scValToNative(result.result.retval)));
      }
    } catch (err) {
      console.warn("Reward fetch failed (contract might not be deployed yet)");
    }
  };

  const connectWallet = async () => {
    try {
      if (!await isConnected()) {
        alert("Please install Freighter wallet extension.");
        return;
      }
      const publicKey = await getPublicKey();
      setWallet(publicKey);
      fetchRewards(publicKey);
      setStatus("Wallet connected successfully!");
    } catch (err) {
      setStatus("Failed to connect wallet.");
    }
  };

  const castVote = async (candidateName) => {
    if (!wallet) {
      setStatus("⚠️ Please connect wallet first!");
      return;
    }

    setLoading(true);
    setStatus(`🗳️ Voting for ${candidateName}...`);

    try {
      const contract = new StellarSdk.Contract(CONTRACT_ID);
      const account = await server.getAccount(wallet);

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            "vote",
            StellarSdk.nativeToScVal(wallet, { type: "address" }),
            StellarSdk.nativeToScVal(candidateName, { type: "symbol" })
          )
        )
        .setTimeout(30)
        .build();

      const signedTx = await signTransaction(tx.toXDR(), { network: "TESTNET" });
      const sendResponse = await server.sendTransaction(StellarSdk.TransactionBuilder.fromXDR(signedTx, NETWORK_PASSPHRASE));

      if (sendResponse.status === "PENDING") {
        let statusResp = await server.getTransaction(sendResponse.hash);
        while (statusResp.status === "NOT_FOUND" || statusResp.status === "PENDING") {
          await new Promise(r => setTimeout(r, 1000));
          statusResp = await server.getTransaction(sendResponse.hash);
        }

        if (statusResp.status === "SUCCESS") {
          setStatus(`✅ Success! You earned 10 VOTER tokens.`);
          fetchCandidates();
          fetchRewards(wallet);
        } else {
          throw new Error("Transaction failed.");
        }
      }
    } catch (err) {
      console.error(err);
      setStatus("❌ Error casting vote. Already voted?");
    } finally {
      setLoading(false);
    }
  };

  const addCandidate = async () => {
    if (!wallet) {
      setStatus("⚠️ Admin: Connect wallet to add candidates.");
      return;
    }
    if (!newCandidate.trim()) return;

    setLoading(true);
    setStatus(`✨ Adding candidate ${newCandidate}...`);

    try {
      const contract = new StellarSdk.Contract(CONTRACT_ID);
      const account = await server.getAccount(wallet);
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: "1000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call("add_candidate", StellarSdk.nativeToScVal(newCandidate.trim(), { type: "symbol" })))
        .setTimeout(30)
        .build();
      const signedTx = await signTransaction(tx.toXDR(), { network: "TESTNET" });
      await server.sendTransaction(StellarSdk.TransactionBuilder.fromXDR(signedTx, NETWORK_PASSPHRASE));
      setStatus(`✅ ${newCandidate} added!`);
      setNewCandidate("");
      fetchCandidates();
    } catch (err) {
      setStatus("❌ Only Admin can add candidates.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      <header>
        <div className="logo-group">
          <h1>StellarVote</h1>
          <span className="status-badge">Soroban v4.0</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {wallet && (
            <div className="glass reward-pill">
              <span className="icon">🏆</span>
              <span className="balance">{rewardBalance} VOTER</span>
            </div>
          )}
          <button id="connect-btn" className="btn btn-primary" onClick={connectWallet}>
            {wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Connect Wallet"}
          </button>
        </div>
      </header>

      <main className="container glass">
        <div style={{ marginBottom: '2rem' }}>
          <h2>Live Poll & Rewards</h2>
          <p style={{ color: 'var(--text-dim)' }}>
            Vote on candidates and earn VOTER tokens as rewards.
          </p>
          {status && (
            <div className={`status-toast ${status.startsWith('❌') ? 'error' : ''}`}>
              {status}
            </div>
          )}
        </div>

        <div className="card-grid">
          {candidates.map((cand, idx) => (
            <div key={idx} className="glass candidate-card">
              <h3>{cand.name}</h3>
              <div className="stats">
                <div className="vote-count">{cand.votes}</div>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Votes Received</div>
              </div>
              <button
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => castVote(cand.name)}
                disabled={loading}
              >
                {loading ? "..." : "Vote & Earn 10"}
              </button>
            </div>
          ))}
        </div>

        <div className="admin-section">
          <hr style={{ margin: '3rem 0', opacity: 0.1 }} />
          <h3>Governance Control</h3>
          <div className="form-group">
            <input
              type="text"
              placeholder="New Candidate Name"
              value={newCandidate}
              onChange={(e) => setNewCandidate(e.target.value)}
            />
            <button className="btn btn-primary" onClick={addCandidate} disabled={loading}>
              Add
            </button>
          </div>
        </div>
      </main>

      <footer style={{ marginTop: 'auto', padding: '2rem', color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center' }}>
        Advanced Contract Pattern: Inter-contract Rewards • Mobile Responsive • CI/CD Ready
      </footer>
    </ErrorBoundary>
  );
}

export default App;
