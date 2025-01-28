#include <eosio/eosio.hpp>
#include <atomicassets-interface.hpp> // Inclure l'interface d'AtomicAssets

using namespace eosio;

CONTRACT burnnft : public contract {
public:
    using contract::contract;

    // Table pour suivre les utilisateurs si nécessaire
    TABLE user {
        name account;
        uint64_t primary_key() const { return account.value; }
    };

    using user_table = eosio::multi_index<"users"_n, user>;

    // Handler pour le transfert de NFT
    [[eosio::on_notify("atomicassets::transfer")]]
    void on_nft_transfer(name from, name to, std::vector<uint64_t> asset_ids, std::string memo) {
        // Vérifie si le contrat reçoit le NFT
        if (to != get_self()) return;

        require_auth(from); // Vérifie que l'expéditeur est autorisé

        // Itérer sur les assets transférés
        for (uint64_t asset_id : asset_ids) {
            // Appel de la fonction de burn d'AtomicAssets
            action(
                permission_level{get_self(), "active"_n},
                "atomicassets"_n, // Contrat AtomicAssets
                "burnasset"_n,    // Action pour brûler un asset
                std::make_tuple(get_self(), asset_id)
            ).send();

            print("Burned NFT with asset_id: ", asset_id, "\n");
        }
    }
};
