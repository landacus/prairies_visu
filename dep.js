import { query } from "./module.js";
import { showDetails } from "./init.js";
import { renderCommuneMap } from "./communes.js";

async function fetchDepartmentData() {
    const sql = `
        SELECT 
            dep_parc as code_dep, 
            AVG(CAST(alt_mean AS DOUBLE)) as alt_moyenne,
            AVG(CAST(pente_mean AS DOUBLE)) as pente_moyenne,
            SUM(CAST(surf_parc AS DOUBLE)) as surface_totale,
            COUNT(*) as nb_prairies
        FROM 'data.parquet'
        GROUP BY dep_parc
    `;
    return await query(sql);
}

export async function renderDepartmentMap() {
    try {
        // 1. On nettoie le SVG actuel
        d3.select("body").selectAll("svg").remove();

        // 2. Requête DuckDB groupée par département
        const stats = await fetchDepartmentData();
        const dataMap = new Map(stats.map(d => [String(d.code_dep), {
            alt_moyenne: d.alt_moyenne,
            pente_moyenne: d.pente_moyenne,
            surface_totale: d.surface_totale,
            nb_prairies: d.nb_prairies
        }]));

        // 3. Charger le GeoJSON des départements
        const depts = await d3.json("https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements.geojson");

        // 4. Configuration de la carte
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

        // MÊME ÉCHELLE DE COULEUR QUE DANS INIT.JS
        const altitudes = stats.map(d => Number(d.alt_moyenne));
        
        const colorScale = d3.scaleSequential(d3.interpolateReds)
                             .domain([Math.min(...altitudes), Math.max(...altitudes)]);

        // Configuration du zoom partagé
        const zoom = d3.zoom()
            .scaleExtent([1, 10]) // Zoom min 1x (taille normale), max 10x
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
                g.selectAll(".department").attr("stroke-width", 1 / event.transform.k);
            });

        svg.call(zoom);

        // 5. Dessin des départements
        g.selectAll(".department")
           .data(depts.features)
           .join("path")
           .attr("class", "department")
           .attr("d", pathGenerator)
           .attr("fill", d => {
               const code = String(d.properties.code);
               const departD = dataMap.get(code);
               return departD ? colorScale(departD.alt_moyenne) : "#eee";
           })
           .attr("stroke", "#fff")
           .attr("stroke-width", 1)
           .on("mouseover", (event, d) => {
               const code = String(d.properties.code);
               const depData = dataMap.get(code);
                showDetails(d.properties.nom, depData);
           })
           .on("click", (event, d) => {
               const code = String(d.properties.code);
               // On zoom sur le département cliqué
               const [[x0, y0], [x1, y1]] = pathGenerator.bounds(d);
               const dx = x1 - x0;
               const dy = y1 - y0;
               const x = (x0 + x1) / 2;
               const y = (y0 + y1) / 2;
               const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
               const translate = [width / 2 - scale * x, height / 2 - scale * y];

               svg.transition()
                  .duration(750)
                  .call(
                      zoom.transform,
                      d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
                  );

               // Afficher les communes du département
                renderCommuneMap('departement', code);
           });

    } catch (err) {
        console.error("Erreur dans renderDepartmentMap :", err);
    }
}