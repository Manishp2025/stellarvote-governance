import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
import * as freighter from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  getPublicKey: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock('@stellar/stellar-sdk', () => {
  const mockServer = {
    simulateTransaction: vi.fn(),
    getLedgerFootprint: vi.fn(),
    getAccount: vi.fn(),
    sendTransaction: vi.fn(),
    getTransaction: vi.fn(),
  };

  return {
    Networks: { TESTNET: 'Test SDF Network ; September 2015' },
    rpc: {
      Server: class {
        constructor() { return mockServer; }
      },
      Api: {
        isSimulationSuccess: vi.fn(),
      }
    },
    Contract: class {
      constructor() {
        return { call: vi.fn() };
      }
    },
    TransactionBuilder: class {
      constructor() {
        return {
          addOperation: vi.fn().mockReturnThis(),
          setTimeout: vi.fn().mockReturnThis(),
          build: vi.fn()
        };
      }
    },
    Account: class {},
    nativeToScVal: vi.fn(),
    scValToNative: vi.fn(),
    BASE_FEE: "100"
  };
});

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the header and connect wallet button', async () => {
    freighter.isConnected.mockResolvedValue(false);
    
    render(<App />);
    
    expect(screen.getByText('StellarVote')).toBeInTheDocument();
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    expect(screen.getByText('Decentralized Polls')).toBeInTheDocument();
  });

  it('shows wallet address when connected on load', async () => {
    freighter.isConnected.mockResolvedValue(true);
    freighter.getPublicKey.mockResolvedValue('GBDUXRZ724XY...');
    
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('GBDUXR...Y...')).toBeInTheDocument();
    });
  });

  it('displays candidate cards from cache initially', async () => {
    freighter.isConnected.mockResolvedValue(false);
    
    // Set cache
    const mockCandidates = [
      { name: "Alice", votes: 5 },
      { name: "Bob", votes: 3 }
    ];
    localStorage.setItem('stellarVote_candidates', JSON.stringify(mockCandidates));
    
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });
});
