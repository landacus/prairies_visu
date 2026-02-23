import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm';
import { renderRegionalMap } from './init.js';
import { renderDepartmentMap } from './dep.js';

let conn;
let posLevel = "region"; // "region" ou "departement"
let zoomLevel = 1;
let position = { x: 0, y: 0 };

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
    const response = await fetch('https://github.com/landacus/prairies_visu/raw/refs/heads/main/data.parquet');
    console.log(response);
    const arrayBuffer = await response.arrayBuffer();
    await db.registerFileBuffer('data.parquet', new Uint8Array(arrayBuffer));

    console.log("DuckDB prêt avec data.parquet chargé !");
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
    const svgElement = d3.select("#france-map").node();
    
    const currentTransform = d3.zoomTransform(svgElement);

    if (scale === 'regions') {
        await renderRegionalMap();
    } else {
        await renderDepartmentMap();
    }

    d3.select("#france-map")
      .call(zoomBehavior.transform, currentTransform);
}


/**
 * LOGIQUE DE VISUALISATION (le cerveau D3.js)
 */
async function main() {
    // On lance le setup une seule fois
    await setup();

    // On charge les données par défaut (par région)
    renderRegionalMap();

    d3.select("#btn-regions").on("click", () => changeView("region"));
    d3.select("#btn-depts").on("click", () => changeView("departement"));
}

// Lancement de l'application au chargement de la page
main();
