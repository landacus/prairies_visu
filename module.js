import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm';
import { renderRegionalMap } from './init.js';
import { renderDepartmentMap } from './dep.js';

let conn;
// Comportement de zoom partagé
const zoomBehavior = d3.zoom()
    .scaleExtent([1, 10]) // Zoom min 1x (taille normale), max 8x
    .on("zoom", (event) => {
        d3.select(".map-content").attr("transform", event.transform);
        d3.selectAll(".region, .department").attr("stroke-width", 1 / event.transform.k);
    });

/**
 * INITIALISATION (Le "Setup")
 * Cette fonction prépare le moteur DuckDB et connecte le fichier Parquet.
 */
async function setup() {
    console.log("Démarrage du moteur DuckDB...");
    
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    const worker_url = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`], {type: 'text/javascript'})
    );

    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);

    conn = await db.connect();

    // Charger le fichier Parquet via fetch
    console.log("Chargement du fichier data.parquet...");
    const arrayBuffer = await fetchAndMerge();
    await db.registerFileBuffer('data.parquet', new Uint8Array(arrayBuffer));

    console.log("DuckDB prêt avec data.parquet chargé !");
}

async function fetchAndMerge() {
    const chunks = ['data.parquet.aa', 'data.parquet.ab', 'data.parquet.ac', 'data.parquet.ad'];
    
    // 1. Fetch all chunks in parallel
    const promises = chunks.map(url => fetch(url).then(res => res.arrayBuffer()));
    const buffers = await Promise.all(promises);

    // 2. Calculate total size
    const totalLength = buffers.reduce((acc, buf) => acc + buf.byteLength, 0);
    const combinedArray = new Uint8Array(totalLength);

    // 3. Manually copy each buffer into the giant array
    let offset = 0;
    for (const buf of buffers) {
        combinedArray.set(new Uint8Array(buf), offset);
        offset += buf.byteLength;
    }

    // Now 'combinedArray' has the magic bytes at the end and can be read
    return combinedArray;
}

/**
 * L'OUTIL DE REQUÊTE (comme "d3.csv" personnalisé)
 * À utiliser pour envoyer du SQL et recevoir des objets JS propres.
 */
export async function query(sql) {
    if (!conn) {
        console.error("DuckDB n'est pas encore initialisé.");
        return [];
    }
    const result = await conn.query(sql);
    return result.toArray().map(row => row.toJSON());
}

async function changeView(scale) {
    // Sauvegarder la transformation actuelle avant de changer de vue
    const svgElement = d3.select("#france-map").node();
    const currentTransform = d3.zoomTransform(svgElement);
    console.log("Transform actuel avant changement de vue :", currentTransform);

    if (scale === 'regions') {
        console.log("Changement de vue : Régions");
        await renderRegionalMap();
    } else if (scale === 'departments') {
        console.log("Changement de vue : Départements");
        await renderDepartmentMap();
    }

    // Réappliquer la transformation après le changement de vue
    d3.select("#france-map").call(zoomBehavior.transform, currentTransform);
}


/**
 * LOGIQUE DE VISUALISATION
 */
async function main() {
    await setup();

    // On charge les données par défaut (par région)
    renderRegionalMap();

    d3.select("#btn-regions").on("click", () => changeView("regions"));
    d3.select("#btn-depts").on("click", () => changeView("departments"));
    
}

// Lancement de l'application au chargement de la page
main();
