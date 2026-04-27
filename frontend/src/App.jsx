import React, { useState, useEffect } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';
import { isConnected, getPublicKey, signTransaction } from '@stellar/freighter-api';

// --- CONFIGURATION ---
const CONTRACT_ID = "CC6O7XG7K6Y7ZJ2V3W5XYG6Y7ZJ2V3W5XYG6Y7ZJ2V3W5XYG6Y7ZJ2V3W"; // PLACEHOLDER: Replace with your actual Contract ID
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

const server = new StellarSdk.rpc.Server(RPC_URL);

function App() {
  const [wallet, setWallet] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [newCandidate, setNewCandidate] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // Check if Freighter is installed and get public key if already connected
  useEffect(() => {
    const checkWallet = async () => {
      if (await isConnected()) {
        const publicKey = await getPublicKey();
        if (publicKey) setWallet(publicKey);
      }
    };
    
    // Load from cache initially
    const cachedCandidates = localStorage.getItem("stellarVote_candidates");
    if (cachedCandidates) {
      try {
        setCandidates(JSON.parse(cachedCandidates));
      } catch (e) {
        console.error("Failed to parse cached candidates", e);
      }
    }

    checkWallet();
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      // Create contract instance
      const contract = new StellarSdk.Contract(CONTRACT_ID);
      
      // Simulate call to list_candidates
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
        
        // Fetch votes for each candidate
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
        // Cache the results
        localStorage.setItem("stellarVote_candidates", JSON.stringify(candidatesWithVotes));
      }
    } catch (err) {
      console.error("Error fetching candidates:", err);
      if (candidates.length === 0) {
        setStatus("Error: Make sure contract is deployed and ID is correct.");
      }
    } finally {
      setLoading(false);
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
      const source = await server.getLedgerFootprint(wallet); // More robust account fetching
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

      // Sign and Send
      const signedTx = await signTransaction(tx.toXDR(), { network: "TESTNET" });
      const sendResponse = await server.sendTransaction(StellarSdk.TransactionBuilder.fromXDR(signedTx, NETWORK_PASSPHRASE));

      if (sendResponse.status === "PENDING") {
        let statusResp = await server.getTransaction(sendResponse.hash);
        while (statusResp.status === "NOT_FOUND" || statusResp.status === "PENDING") {
          await new Promise(r => setTimeout(r, 1000));
          statusResp = await server.getTransaction(sendResponse.hash);
        }

        if (statusResp.status === "SUCCESS") {
          setStatus(`✅ Vote cast for ${candidateName}!`);
          fetchCandidates();
        } else {
          throw new Error("Transaction failed on-chain.");
        }
      }
    } catch (err) {
      console.error(err);
      if (err.message?.includes("User declined")) {
        setStatus("❌ Transaction rejected by user.");
      } else {
        setStatus("❌ Error: Already voted or Candidate not found.");
      }
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
        .addOperation(
          contract.call("add_candidate", StellarSdk.nativeToScVal(newCandidate.trim(), { type: "symbol" }))
        )
        .setTimeout(30)
        .build();

      const signedTx = await signTransaction(tx.toXDR(), { network: "TESTNET" });
      await server.sendTransaction(StellarSdk.TransactionBuilder.fromXDR(signedTx, NETWORK_PASSPHRASE));
      
      setStatus(`✅ ${newCandidate} added to election!`);
      setNewCandidate("");
      fetchCandidates();
    } catch (err) {
      console.error(err);
      setStatus("❌ Only Admin can add candidates.");
    } finally {
      setLoading(false);
    }
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
          <h2>Decentralized Polls</h2>
          <p style={{ color: 'var(--text-dim)' }}>
            Empowering governance through Soroban smart contracts.
          </p>
          {status && (
            <div className={`status-toast ${status.startsWith('❌') ? 'error' : ''}`}>
              {status}
            </div>
          )}
        </div>

        <div className="card-grid">
          {candidates.length === 0 && !loading && (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', opacity: 0.5 }}>No candidates found in contract.</p>
          )}
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
          <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.9rem' }}>Only the contract admin can add new candidates.</p>
          <div className="form-group">
            <input
              id="candidate-input"
              type="text"
              placeholder="Candidate Name (Symbol)"
              value={newCandidate}
              onChange={(e) => setNewCandidate(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCandidate()}
            />
            <button id="add-candidate-btn" className="btn btn-primary" onClick={addCandidate} disabled={loading}>
              Add Candidate
            </button>
          </div>
        </div>
      </main>

      <footer style={{ marginTop: 'auto', padding: '2rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
        Built with Soroban & React • Verified Level 3 Implementation • v3.1.0
      </footer>
    </>
  );
}

export default App;
