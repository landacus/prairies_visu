import { query } from "./module.js";

async function fetchCorrelationData() {
    const sql = `
        SELECT 
            CAST(alt_mean AS DOUBLE) as alt, 
            CAST(pente_mean AS DOUBLE) as pente,
            reg_parc as region -- On récupère le nom ou code de la région
        FROM 'data.parquet'
        WHERE alt_mean IS NOT NULL AND pente_mean IS NOT NULL
        LIMIT 200000 
    `;
    return await query(sql);
}

export async function renderScatterPlot() {
    try {
        d3.select("body").selectAll("svg").remove();
        const data = await fetchCorrelationData();

        const margin = {top: 50, right: 150, bottom: 60, left: 60}; // Plus de marge à droite pour la légende
        const width = 900 - margin.left - margin.right;
        const height = 500 - margin.top - margin.bottom;

        // Création du div pour le tooltip (caché par défaut)
        const tooltip = d3.select("body").append("div")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background-color", "white")
            .style("border", "1px solid #ddd")
            .style("padding", "10px")
            .style("border-radius", "5px")
            .style("font-family", "sans-serif");

        const svg = d3.select("body").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Échelles
        const xScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.alt)]).range([0, width]);
        const yScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.pente)]).range([height, 0]);

        // Échelle de couleurs pour les régions
        const regions = [...new Set(data.map(d => d.region))];
        const colorScale = d3.scaleOrdinal(d3.schemeTableau10)
            .domain(regions);

        // Axes
        svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(xScale));
        svg.append("g").call(d3.axisLeft(yScale));

        // Dessin des points
        svg.append('g')
            .selectAll("dot")
            .data(data)
            .join("circle")
                .attr("cx", d => xScale(d.alt))
                .attr("cy", d => yScale(d.pente))
                .attr("r", 4)
                .style("fill", d => colorScale(d.region))
                .style("opacity", 0.7)
                .attr("stroke", "#fff")
                .attr("stroke-width", 0.5)
            // Événements de survol (Tooltip)
            .on("mouseover", (event, d) => {
                tooltip.style("visibility", "visible")
                       .html(`<strong>Région:</strong> ${d.region}<br/>
                              <strong>Altitude:</strong> ${Math.round(d.alt)}m<br/>
                              <strong>Pente:</strong> ${Math.round(d.pente)}%`);
                d3.select(event.currentTarget).attr("r", 7).style("opacity", 1);
            })
            .on("mousemove", (event) => {
                tooltip.style("top", (event.pageY - 10) + "px")
                       .style("left", (event.pageX + 10) + "px");
            })
            .on("mouseout", (event) => {
                tooltip.style("visibility", "hidden");
                d3.select(event.currentTarget).attr("r", 4).style("opacity", 0.7);
            });

        // Ajout d'une légende
        const legend = svg.selectAll(".legend")
            .data(regions)
            .join("g")
            .attr("transform", (d, i) => `translate(${width + 20}, ${i * 20})`);

        legend.append("rect").attr("width", 15).attr("height", 15).style("fill", colorScale);
        legend.append("text").attr("x", 25).attr("y", 12).text(d => d).style("font-size", "12px");

    } catch (err) {
        console.error("Erreur :", err);
    }
}
