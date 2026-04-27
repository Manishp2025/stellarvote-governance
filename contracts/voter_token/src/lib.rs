#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, symbol_short};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Balance(Address),
}

#[contract]
pub struct VoterToken;

#[contractimpl]
impl VoterToken {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Not initialized");
        admin.require_auth();

        let mut balance: i128 = env.storage().instance().get(&DataKey::Balance(to.clone())).unwrap_or(0);
        balance += amount;
        env.storage().instance().set(&DataKey::Balance(to.clone()), &balance);

        // Publish event
        env.events().publish((symbol_short!("token"), symbol_short!("mint")), (to, amount));
    }

    pub fn balance_of(env: Env, user: Address) -> i128 {
        env.storage().instance().get(&DataKey::Balance(user)).unwrap_or(0)
    }
}

mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_minting() {
        let env = Env::default();
        let contract_id = env.register_contract(None, VoterToken);
        let client = VoterTokenClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        client.initialize(&admin);

        env.mock_all_auths();
        client.mint(&user, &100);

        assert_eq!(client.balance_of(&user), 100);
    }
}
