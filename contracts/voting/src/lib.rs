#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Vec};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Candidate(Symbol),
    Voted(Address),
    Candidates,
    TokenId,
}

// Interface for the Reward Token contract
mod token {
    use soroban_sdk::{Address, Env};
    #[soroban_sdk::contractclient(name = "TokenClient")]
    pub trait TokenTrait {
        fn mint(env: Env, to: Address, amount: i128);
        fn balance_of(env: Env, user: Address) -> i128;
    }
}

#[contract]
pub struct VotingContract;

#[contractimpl]
impl VotingContract {
    pub fn init(env: Env, admin: Address, token_id: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenId, &token_id);
        
        let candidates: Vec<Symbol> = Vec::new(&env);
        env.storage().instance().set(&DataKey::Candidates, &candidates);
    }

    pub fn add_candidate(env: Env, name: Symbol) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Not initialized");
        admin.require_auth();

        let mut candidates: Vec<Symbol> = env.storage().instance().get(&DataKey::Candidates).unwrap();
        candidates.push_back(name.clone());
        env.storage().instance().set(&DataKey::Candidates, &candidates);
        env.storage().instance().set(&DataKey::Candidate(name.clone()), &0u32);

        // Publish Event
        env.events().publish((symbol_short!("vote"), symbol_short!("add_cand")), name);
    }

    pub fn vote(env: Env, voter: Address, candidate: Symbol) {
        voter.require_auth();

        // Check if already voted
        if env.storage().instance().has(&DataKey::Voted(voter.clone())) {
            panic!("Already voted");
        }

        // Check if candidate exists and increment vote
        let votes: u32 = env.storage().instance().get(&DataKey::Candidate(candidate.clone())).expect("Candidate not found");
        env.storage().instance().set(&DataKey::Candidate(candidate.clone()), &(votes + 1));

        // Mark as voted
        env.storage().instance().set(&DataKey::Voted(voter.clone()), &true);

        // Reward voter with 10 tokens
        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).expect("Token not set");
        let token_client = token::TokenClient::new(&env, &token_id);
        token_client.mint(&voter, &10i128);

        // Publish Event
        env.events().publish((symbol_short!("vote"), symbol_short!("cast")), (voter, candidate));
    }

    pub fn get_votes(env: Env, candidate: Symbol) -> u32 {
        env.storage().instance().get(&DataKey::Candidate(candidate)).unwrap_or(0)
    }

    pub fn list_candidates(env: Env) -> Vec<Symbol> {
        env.storage().instance().get(&DataKey::Candidates).unwrap_or(Vec::new(&env))
    }

    pub fn get_token_id(env: Env) -> Address {
        env.storage().instance().get(&DataKey::TokenId).expect("Token not set")
    }
}

mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use voter_token::{VoterToken, VoterTokenClient};

    #[test]
    fn test_voting_flow() {
        let env = Env::default();
        let voting_id = env.register_contract(None, VotingContract);
        let voting_client = VotingContractClient::new(&env, &voting_id);

        let token_id = env.register_contract(None, VoterToken);
        let token_client = VoterTokenClient::new(&env, &token_id);

        let admin = Address::generate(&env);
        let voter1 = Address::generate(&env);
        let voter2 = Address::generate(&env);

        token_client.initialize(&voting_id); // Voting contract is the admin of the token
        voting_client.init(&admin, &token_id);

        let cand1 = symbol_short!("Alice");
        let cand2 = symbol_short!("Bob");

        // Test 1: Add candidates
        env.mock_all_auths();
        voting_client.add_candidate(&cand1);
        voting_client.add_candidate(&cand2);

        assert_eq!(voting_client.list_candidates(), Vec::from_array(&env, [cand1.clone(), cand2.clone()]));

        // Test 2: Vote and check rewards
        voting_client.vote(&voter1, &cand1);
        assert_eq!(voting_client.get_votes(&cand1), 1);
        assert_eq!(token_client.balance_of(&voter1), 10);

        voting_client.vote(&voter2, &cand1);
        assert_eq!(voting_client.get_votes(&cand1), 2);
        assert_eq!(token_client.balance_of(&voter2), 10);
    }

    #[test]
    #[should_panic(expected = "Already voted")]
    fn test_double_voting() {
        let env = Env::default();
        let voting_id = env.register_contract(None, VotingContract);
        let voting_client = VotingContractClient::new(&env, &voting_id);
        let token_id = env.register_contract(None, VoterToken);
        let token_client = VoterTokenClient::new(&env, &token_id);

        let admin = Address::generate(&env);
        let voter = Address::generate(&env);
        token_client.initialize(&voting_id);
        voting_client.init(&admin, &token_id);

        let cand1 = symbol_short!("Alice");
        env.mock_all_auths();
        voting_client.add_candidate(&cand1);

        voting_client.vote(&voter, &cand1);
        voting_client.vote(&voter, &cand1); // Should panic
    }

    #[test]
    #[should_panic(expected = "Already initialized")]
    fn test_double_init() {
        let env = Env::default();
        let contract_id = env.register_contract(None, VotingContract);
        let client = VotingContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token_id = Address::generate(&env);
        client.init(&admin, &token_id);
        client.init(&admin, &token_id); // Should panic
    }
}
