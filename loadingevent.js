const fs = require("fs");
const path = require("path");

// Dossier contenant les fichiers JSON des cartes
const MAPS_DIRECTORY = "./maps";

// Types d'activités à détecter
const activityTypes = { Wood: "chop", Fish: "fish", Stone: "mine" };

// Charger toutes les cartes dans un objet
const loadMaps = () => {
    const mapsData = {};
    const files = fs.readdirSync(MAPS_DIRECTORY);

    files.forEach(file => {
        if (file.endsWith(".json")) {
            const mapId = path.basename(file, ".json");
            const mapContent = JSON.parse(fs.readFileSync(path.join(MAPS_DIRECTORY, file), "utf-8"));
            mapsData[mapId] = mapContent;
        }
    });

    return mapsData;
};

// Créer une hashmap des activités par carte avec les données simplifiées
const createActivityHashmap = (mapsData) => {
    const mapsHashmap = {};

    Object.entries(mapsData).forEach(([mapId, mapContent]) => {
        const hashmap = {};
        const events = mapContent.events || {};

        Object.values(events).forEach(event => {
            // Vérifiez que l'événement est bien défini
            if (!event || !event.name || !event.x || !event.y) {
                console.warn(`Skipping invalid event on map '${mapId}':`, event);
                return;
            }

            const name = event.name;
            if (activityTypes[name]) {
                const x = event.x;
                const y = event.y;

                // Ajouter la position à la hashmap avec les données simplifiées
                hashmap[`${x},${y}`] = {
                    name, // Nom de l'événement (ex: "Wood")
                    type: activityTypes[name], // Type d'activité (ex: "chop")
                    players: [] // Liste des joueurs ayant interagi
                };
            }
        });

        mapsHashmap[mapId] = hashmap;
    });

    return mapsHashmap;
};


// Gérer une action pour un joueur
const performAction = (mapId, x, y, playerId, mapsHashmap) => {
    if (!mapsHashmap[mapId] || !mapsHashmap[mapId][`${x},${y}`]) {
        return { success: false, message: "Invalid position or map ID" };
    }

    const activity = mapsHashmap[mapId][`${x},${y}`];
    const timestamp = new Date().toISOString();

    // Ajouter le joueur à la liste des joueurs
    activity.players.push({ playerId, timestamp });

    return {
        success: true,
        message: `Action '${activity.type}' performed at (${x}, ${y})`,
        details: activity
    };
};

// Sauvegarder les états dans les fichiers JSON
const saveMapStates = (mapsData, mapsHashmap) => {
    Object.entries(mapsHashmap).forEach(([mapId, hashmap]) => {
        const mapContent = mapsData[mapId];

        // Ajouter les joueurs au contenu de la carte
        Object.entries(hashmap).forEach(([position, activity]) => {
            const [x, y] = position.split(",").map(Number);
            if (!mapContent.events) mapContent.events = {};
            if (!mapContent.events[position]) mapContent.events[position] = { x, y };
            mapContent.events[position].players = activity.players;
        });

        // Sauvegarder dans le fichier
        const filePath = path.join(MAPS_DIRECTORY, `${mapId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(mapContent, null, 2), "utf-8");
    });
};

// Sauvegarder la hashmap consolidée dans un fichier JSON
const saveConsolidatedHashmap = (mapsHashmap) => {
    const outputPath = path.join(MAPS_DIRECTORY, "main_maps.json");
    fs.writeFileSync(outputPath, JSON.stringify(mapsHashmap, null, 2), "utf-8");
    console.log(`Consolidated hashmap saved to ${outputPath}`);
};


// Exemple d'utilisation
const main = () => {
    // Charger les cartes
    const mapsData = loadMaps();

    // Créer la hashmap des activités
    const mapsHashmap = createActivityHashmap(mapsData);

    // Exemple : Ajouter une action pour un joueur
    const result = performAction("Map030", 7, 2, "Player123", mapsHashmap);
    console.log(result);

    // Sauvegarder les modifications locales sur les cartes individuelles
    saveMapStates(mapsData, mapsHashmap);

    // Sauvegarder la hashmap consolidée dans un fichier unique
    saveConsolidatedHashmap(mapsHashmap);
};

// Exécuter le script
main();

