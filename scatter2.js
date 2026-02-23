import { query } from "./module.js";

// Niveau 1 : Moyennes par région
async function fetchRegionStats() {
    return await query(`
        SELECT reg_parc as label, 
               AVG(CAST(alt_mean AS DOUBLE)) as alt, 
               AVG(CAST(pente_mean AS DOUBLE)) as pente,
               'region' as level
        FROM 'data.parquet'
        GROUP BY reg_parc
    `);
}

// Niveau 2 : Moyennes par département pour une région donnée
async function fetchDeptStats(regionName) {
    return await query(`
        SELECT dep_parc as label, 
               AVG(CAST(alt_mean AS DOUBLE)) as alt, 
               AVG(CAST(pente_mean AS DOUBLE)) as pente,
               'dept' as level
        FROM 'data.parquet'
        WHERE reg_parc = '${regionName}'
        GROUP BY dep_parc
    `);
}

// Niveau 3 : Données brutes pour un département donné
async function fetchRawData(deptCode) {
    return await query(`
        SELECT CAST(alt_mean AS DOUBLE) as alt, 
               CAST(pente_mean AS DOUBLE) as pente, 
               'raw' as level
        FROM 'data.parquet'
        WHERE dep_parc = '${deptCode}'
        LIMIT 10000
    `);
}

export async function renderDrillDownPlot() {
    const margin = {top: 50, right: 50, bottom: 60, left: 60};
    const width = 1200 - margin.left - margin.right;
    const height = 700 - margin.top - margin.bottom;

    // Initialisation du SVG
    d3.select("body").selectAll("svg, .tooltip, .back-btn").remove();
    
    // Bouton de retour
    const backBtn = d3.select("body").append("button")
        .attr("class", "back-btn")
        .text("⬅ Retour au niveau supérieur")
        .style("display", "none")
        .on("click", () => loadLevel("region"));

    const svg = d3.select("body").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = d3.select("body").append("div").attr("class", "tooltip")
        .style("position", "absolute").style("visibility", "hidden")
        .style("background", "white").style("padding", "8px").style("border", "1px solid #ccc");

    // Échelles fixes pour garder une référence visuelle (ou dynamiques selon votre choix)
    const x = d3.scaleLinear().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);

    const xAxis = svg.append("g").attr("transform", `translate(0,${height})`);
    const yAxis = svg.append("g");

    // On déclare ces variables en haut de renderDrillDownPlot pour qu'elles soient accessibles partout
    let currentLevel = "region";
    let currentRegion = null; 

    async function loadLevel(level, id = null) {
        let data;
        
        if (level === "region") {
            currentLevel = "region";
            currentRegion = null; // On réinitialise
            data = await fetchRegionStats();
            
            backBtn.style("display", "none");
            updateTitle("Moyennes par région");
        } 
        else if (level === "dept") {
            currentLevel = "dept";
            currentRegion = id; // On stocke la région pour le futur retour
            data = await fetchDeptStats(id);
            
            backBtn.style("display", "block")
                .on("click", () => loadLevel("region"));
            updateTitle(`Départements de la région : ${id}`);
        } 
        else if (level === "raw") {
            currentLevel = "raw";
            data = await fetchRawData(id);
            
            backBtn.style("display", "block")
                .on("click", () => loadLevel("dept", currentRegion));
            updateTitle(`Données brutes du département : ${id}`);
        }
        
        if (data && data.length > 0) {
            updateChart(data);
        } else {
            console.warn("Aucune donnée trouvée pour ce niveau:", level, id);
        }
    }
    
    function updateTitle(text) {
        svg.selectAll(".chart-title").remove();
        svg.append("text")
            .attr("class", "chart-title")
            .attr("x", width / 2)
            .attr("y", -20)
            .attr("text-anchor", "middle")
            .style("font-weight", "bold")
            .text(text);
    }


    function updateChart(data) {
        console.log(data)
        // 1. Calcul des nouvelles borne
        const maxAlt = d3.max(data, d => d.alt);
        const maxPente = d3.max(data, d => d.pente);

        // On ajuste les domaines des échelles existantes
        x.domain([0, maxAlt * 1.05]); 
        y.domain([0, maxPente * 1.05]);

        // 2. Animation des axes
        xAxis.transition().duration(750).call(d3.axisBottom(x));
        yAxis.transition().duration(750).call(d3.axisLeft(y));

        // 3. Mise à jour des cercles
        const circles = svg.selectAll("circle").data(data);

        circles.join(
            enter => enter.append("circle")
                .attr("r", 0)
                .attr("cx", d => x(d.alt))
                .attr("cy", d => y(d.pente))
                .call(enter => enter.transition().duration(750)
                    .attr("r", d => d.level === 'raw' ? 2 : 8)), // Points plus petits si bcp de données
            update => update.transition().duration(750)
                .attr("cx", d => x(d.alt))
                .attr("cy", d => y(d.pente))
                .attr("r", d => d.level === 'raw' ? 2 : 8),
            exit => exit.transition().duration(500).attr("r", 0).remove()
        )
        .style("fill", d => {
            if (d.level === 'region') return "#e74c3c";
            if (d.level === 'dept') return "#3498db";
            return "#2ecc71";
        })
        .style("opacity", d => d.level === 'raw' ? 0.4 : 0.8)
        .attr("stroke", d => d.level === 'raw' ? "none" : "#fff")
        .on("mouseover", (event, d) => {
            tooltip.style("visibility", "visible");

            let content = "";

            // Si c'est une Région ou un Département (on affiche les moyennes)
            if (d.level === "region" || d.level === "dept") {
                content = `
                    <div style="font-weight:bold; color:#333; margin-bottom:5px;">${d.label}</div>
                    <div style="font-size: 0.9em;">
                        <strong>Altitude moy. :</strong> ${Math.round(d.alt)} m<br/>
                        <strong>Pente moy. :</strong> ${d.pente.toFixed(2)} %
                    </div>
                `;
            } 
            // Si ce sont les données brutes
            else {
                content = `
                    <div style="font-weight:bold; color:#2ecc71;">Prairie individuelle</div>
                    <div style="font-size: 0.9em;">
                        <strong>Altitude :</strong> ${Math.round(d.alt)} m<br/>
                        <strong>Pente :</strong> ${d.pente.toFixed(2)} %
                    </div>
                `;
            }

            tooltip.html(content);
        })
        .on("mousemove", (event) => {
            tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
        })
        .on("mouseout", () => tooltip.style("visibility", "hidden"))
        .on("click", (event, d) => {
            if (d.level === "region") loadLevel("dept", d.label);
            else if (d.level === "dept") loadLevel("raw", d.label);
        });
    }

    // Lancer le premier niveau
    loadLevel("region");
}


