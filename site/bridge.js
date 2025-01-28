// Import des dépendances WharfKit
import { SessionKit } from "@wharfkit/session";
import { WebRenderer } from "@wharfkit/web-renderer";
import { WalletPluginCloudWallet } from "@wharfkit/wallet-plugin-cloudwallet";
import { WalletPluginAnchor } from "@wharfkit/wallet-plugin-anchor";

// Initialisation de l'application
const webRenderer = new WebRenderer();
const args = {
    appName: "New Genesis Bridge",
    chains: [
        {
            id: "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4",
            url: "https://wax.eosphere.io",
        },
    ],
    ui: webRenderer,
    walletPlugins: [new WalletPluginCloudWallet(), new WalletPluginAnchor()],
};

const sessionKit = new SessionKit(args);

let session = null;
let walletNfts = [];
let templateDetails = {};

// Éléments du DOM
const connectWalletButton = document.getElementById("connectWalletButton");
const disconnectWalletButton = document.getElementById("disconnectWalletButton");
const walletInfoDiv = document.getElementById("walletInfo");
const walletNftsDiv = document.getElementById("walletNfts");
const transferNftButton = document.getElementById("transferNftButton");

// Charger les détails des templates depuis le fichier JSON
const loadTemplateDetails = async () => {
    try {
        const response = await fetch("./templateDetails.json");
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        templateDetails = await response.json();
        console.log("Template details loaded:", templateDetails);
    } catch (error) {
        console.error("Error loading template details:", error);
    }
};

// Connexion au wallet
const connectWallet = async () => {
    try {
        console.log("Tentative de connexion au wallet...");
        const response = await sessionKit.login();
        session = response.session;

        const walletAddress = session.actor.toString();
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userAccount", walletAddress);

        console.log("Wallet connecté :", walletAddress);
        updateUIAfterLogin(walletAddress);
        await fetchWalletNfts(walletAddress);
    } catch (error) {
        console.error("Erreur lors de la connexion au wallet :", error);
        alert("Connexion échouée. Veuillez réessayer.");
    }
};

// Déconnexion du wallet
const disconnectWallet = () => {
    console.log("Déconnexion du wallet...");
    session = null;
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userAccount");

    walletNfts = [];
    renderWalletNfts();
    updateUIAfterLogout();
    console.log("Wallet déconnecté !");
};

// Vérification d'une session existante
const checkExistingSession = async () => {
    await loadTemplateDetails();
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    const userAccount = localStorage.getItem("userAccount");

    if (isLoggedIn && userAccount) {
        console.log("Session existante détectée :", userAccount);
        updateUIAfterLogin(userAccount);
        await fetchWalletNfts(userAccount);
    }
};

// Mise à jour de l'interface après connexion
const updateUIAfterLogin = (userAccount) => {
    walletInfoDiv.textContent = `Connecté en tant que : ${userAccount}`;
    connectWalletButton.style.display = "none";
    disconnectWalletButton.style.display = "inline-block";
};

// Mise à jour de l'interface après déconnexion
const updateUIAfterLogout = () => {
    walletInfoDiv.textContent = "Non connecté.";
    connectWalletButton.style.display = "inline-block";
    disconnectWalletButton.style.display = "none";
};

// Récupérer les NFTs depuis l'API AtomicAssets
const fetchWalletNfts = async (wallet) => {
    console.log("Fetching NFTs for wallet:", wallet);
    try {
        const response = await fetch(
            `https://atomic-api.wax.cryptolions.io/atomicassets/v1/accounts/${wallet}/alien.worlds`
        );
        const data = await response.json();
        walletNfts = data?.data?.templates || [];
        renderWalletNfts();
    } catch (error) {
        console.error("Error fetching wallet NFTs:", error);
        walletNftsDiv.innerHTML = "<p>Erreur lors du chargement des NFTs.</p>";
    }
};

// Rendu des NFTs
// Rendu des NFTs avec sélection et quantité
const renderWalletNfts = () => {
    walletNftsDiv.innerHTML = `
        <h2 class="text-center my-4">Your Wallet NFTs</h2>
        <div class="row" id="nftsGrid"></div>
    `;

    const grid = walletNftsDiv.querySelector("#nftsGrid");

    if (walletNfts.length > 0) {
        walletNfts.forEach((nft, index) => {
            const templateDetail = templateDetails.find(
                (template) => String(template.template_id) === String(nft.template_id)
            );

            const col = document.createElement("div");
            col.className = "col-6 col-md-4 col-lg-2 mb-4";

            if (templateDetail) {
                const imgSrc = `https://ipfs.io/ipfs/${templateDetail.attributes.img}`;
                const name = templateDetail.attributes.name;
                const rarity = templateDetail.attributes.rarity;

                col.innerHTML = `
                    <div class="card text-center">
                        <img src="${imgSrc}" class="card-img-top" alt="${name}" style="max-width: 100%; height: auto; object-fit: contain;">
                        <div class="card-body">
                            <h6 class="card-title" style="font-size: 0.9rem;">${name}</h6>
                            <p class="text-muted" style="font-size: 0.8rem;"><strong>Rarity:</strong> ${rarity}</p>
                            <p class="text-muted" style="font-size: 0.8rem;"><strong>Assets:</strong> ${nft.assets}</p>
                            <div class="form-check mt-2">
                                <input type="checkbox" class="form-check-input" id="select-nft-${index}">
                                <label class="form-check-label" for="select-nft-${index}">Select</label>
                            </div>
                            <input type="number" class="form-control mt-2" id="quantity-nft-${index}" min="1" placeholder="Qty">
                        </div>
                    </div>
                `;
            } else {
                col.innerHTML = `
                    <div class="card text-center">
                        <div class="card-body">
                            <p class="text-danger">Template ID: ${nft.template_id}</p>
                            <p class="text-muted">Details not found.</p>
                        </div>
                    </div>
                `;
            }

            grid.appendChild(col);
        });
    } else {
        grid.innerHTML = `<p class="text-center text-danger">No NFTs found.</p>`;
    }
};

// Gestion du transfert des NFTs sélectionnés
const transferSelectedNfts = async () => {
    if (!session) {
        alert("Veuillez connecter votre wallet.");
        return;
    }

    const recipient = document.getElementById("recipientWallet").value;
    if (!recipient) {
        alert("Veuillez renseigner l'adresse du wallet receveur.");
        return;
    }

    const selectedNfts = [];
    walletNfts.forEach((nft, index) => {
        const checkbox = document.getElementById(`select-nft-${index}`);
        const quantityField = document.getElementById(`quantity-nft-${index}`);
        if (checkbox && checkbox.checked) {
            const quantity = parseInt(quantityField.value, 10) || 1;
            for (let i = 0; i < quantity; i++) {
                selectedNfts.push(nft.template_id);
            }
        }
    });
    //Il me faudrait un asset id au lieu d'un template id
    // Il faut faire une requete API sur ce template id de ce compte en particuler pour recuperer tous les differents assets id
    // Et enfin en selectionner la quantité demandé pour passé au transfert
    if (selectedNfts.length === 0) {
        alert("Aucun NFT sélectionné pour le transfert.");
        return;
    }

    try {
        const action = {
            account: "atomicassets",
            name: "transfer",
            authorization: [
                {
                    actor: session.actor.toString(),
                    permission: "active",
                },
            ],
            data: {
                from: session.actor.toString(),
                to: recipient,
                asset_ids: selectedNfts,
                memo: "Transfert via New Genesis Bridge",
            },
        };

        const result = await session.transact({ actions: [action] }, { broadcast: true });
        console.log("Transfert réussi :", result);
        alert("NFTs transférés avec succès !");
    } catch (error) {
        console.error("Erreur lors du transfert de NFT :", error);
        alert("Le transfert a échoué. Veuillez réessayer.");
    }
};

// Gestion des événements
transferNftButton.addEventListener("click", transferSelectedNfts);


// Gestion des événements
connectWalletButton.addEventListener("click", connectWallet);
disconnectWalletButton.addEventListener("click", disconnectWallet);

// Vérification de session au chargement
checkExistingSession();
