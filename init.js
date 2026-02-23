import { query } from './module.js';

/**
 * FONCTION DE CHARGEMENT DES DONNÉES INITIALES
 * Requête pour obtenir des données agrégées par région.
 */


async function chargerDonneesInitiales() {

    const sql = `
        SELECT 
            reg_parc as code_reg, 
            AVG(CAST(alt_mean AS DOUBLE)) as alt_moyenne,
            AVG(CAST(pente_mean AS DOUBLE)) as pente_moyenne,
            SUM(CAST(surf_parc AS DOUBLE)) as surface_totale,
            COUNT(*) as nb_prairies
        FROM 'data.parquet'
        GROUP BY reg_parc
        ORDER BY code_reg
    `;
    return await query(sql);
}


export async function renderRegionalMap() {
    // On nettoie le SVG actuel
    d3.select("body").selectAll("svg").remove();
    const dataMap = await chargerDonneesInitiales();
    // Convertir l'array en Map pour un accès facile
    const dataByRegion = new Map(dataMap.map(d => [
        d.code_reg, 
        {
            ...d,
            alt_moyenne: Number(d.alt_moyenne),
            pente_moyenne: Number(d.pente_moyenne),
            surface_totale: Number(d.surface_totale),
            nb_prairies: Number(d.nb_prairies)
        }
    ]));
    
    console.log("Data by region :", dataByRegion);

    // Charger le fond de carte (GeoJSON simplifié)
    const regions = await d3.json("https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/regions.geojson");
    
    console.log("Première région :", regions.features[0]);
    console.log("Propriétés disponibles :", Object.keys(regions.features[0]?.properties || {}));

    // Configuration de la carte
    const width = 800;
    const height = 600;
    const svg = d3.select("body").append("svg")
                .attr("id", "france-map")
                .attr("width", width)
                .attr("height", height);

    const g = svg.append("g").attr("class", "map-content");

    const projection = d3.geoConicConformal()
                        .center([2.454071, 46.279229])
                        .scale(2600)
                        .translate([width / 2, height / 2]);

    const pathGenerator = d3.geoPath().projection(projection);

    // Échelle de couleur pour l'altitude
    const altitudes = Array.from(dataByRegion.values())
                           .map(d => d.alt_moyenne)
                           .filter(v => !isNaN(v));
    
    console.log("Altitudes :", altitudes);
    console.log("Min :", Math.min(...altitudes), "Max :", Math.max(...altitudes));
    
    const colorScale = d3.scaleSequential(d3.interpolateViridis)
                         .domain([Math.min(...altitudes), Math.max(...altitudes)]);

    console.log("ColorScale créée");

    // Configuration du zoom
    const zoom = d3.zoom()
    .scaleExtent([1, 8]) // Zoom min 1x (taille normale), max 8x
    .on("zoom", (event) => {
        // Applique la transformation (translation et échelle) au groupe <g>
        g.attr("transform", event.transform);
        
        // Optionnel : ajuster l'épaisseur du trait pour qu'il ne grossisse pas trop
        g.selectAll(".region").attr("stroke-width", 1 / event.transform.k);
    });

    svg.call(zoom);

    // Dessin des régions
    console.log("Avant selectAll");
    
    g.selectAll(".region")
       .data(regions.features)
       .join("path")
       .attr("class", "region")
       .attr("d", pathGenerator)
       .attr("fill", d => {
           const code = String(d.properties.code);
           const regData = dataByRegion.get(code);
           return regData ? colorScale(regData.alt_moyenne) : "#eee";
       })
       .attr("stroke", "#fff")
       .on("click", (event, d) => {
           if (!d?.properties) return;
           const code = String(d.properties.code);
           const regData = dataByRegion.get(code);
           if (regData) {
               const nom = d.properties.nom;
               showDetails(nom, regData);
           }
       });
}

export function showDetails(nom, data) {
    console.log("Détails pour", nom, data);
    d3.select("#sidebar").html(`
        <div id="entity-details">
            <h2>${nom || "Entité inconnue"}</h2>
            <p><strong>Nombre de prairies :</strong> ${data.nb_prairies || 0}</p>
            <p><strong>Surface totale :</strong> ${Math.round(data.surface_totale || 0)} ha</p>
            <p><strong>Altitude moyenne :</strong> ${Math.round(data.alt_moyenne || 0)} m</p>
            <p><strong>Pente moyenne :</strong> ${Math.round(data.pente_moyenne || 0)}°</p>
        `);
}