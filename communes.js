import { query } from "./module.js";
import { showDetails } from "./init.js";

async function fetchCommuneData(type, code) {
    const sql = `
        SELECT 
            com_parc as code_com, 
            AVG(CAST(alt_mean AS DOUBLE)) as alt_moyenne,
            AVG(CAST(pente_mean AS DOUBLE)) as pente_moyenne,
            SUM(CAST(surf_parc AS DOUBLE)) as surface_totale,
            COUNT(*) as nb_prairies
        FROM 'data.parquet'
        WHERE com_parc IS NOT NULL AND 
            ${type === 'region' ? `reg_parc = '${code}'` : `dep_parc = '${code}'`}
        GROUP BY com_parc
    `;
    return await query(sql);
}

export async function renderCommuneMap(type, code) {
    console.log(`Rendu de la carte des communes pour ${type} ${code}...`);
    const stats = await fetchCommuneData(type, code);
    const dataMap = new Map(stats.map(d => [String(d.code_com), {
        alt_moyenne: d.alt_moyenne,
        pente_moyenne: d.pente_moyenne,
        surface_totale: d.surface_totale,
        nb_prairies: d.nb_prairies
    }]));
    
    console.log("Data by commune :", dataMap);
}