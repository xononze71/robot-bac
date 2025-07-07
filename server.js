const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const SITES_CONFIG = [
    {
        nom: "AGCE-DECO",
        url: "https://agce.exam-deco.org/edit/resultats-examen-bac-2025/",
        matricule_field_name: "matricule",
        result_selectors: {
            status: "h3.text-success, h3.text-danger",
            points: "p.total-points"
        }
    },
    {
        nom: "MEN-DECO (Portail)",
        url: "https://www.men-deco.org/",
        matricule_field_name: "search_matricule",
         result_selectors: {
            status: ".result-status",
            points: ".result-points"
        }
    },
    {
        nom: "MEN-DECO (Lien direct)",
        url: "https://www.men-deco.org/resultats-bac-2025/",
        matricule_field_name: "matricule_field",
         result_selectors: {
            status: "div.status-admis, div.status-refuse",
            points: "span.points-obtenus"
        }
    },
    {
        nom: "ITDECO",
        url: "https://itdeco.ci/examens/resultat/bac/",
        matricule_field_name: "matricule",
         result_selectors: {
            status: "#resultat_div .statut",
            points: "#resultat_div .points"
        }
    }
];

app.get('/api/resultat', async (req, res) => {
    const { matricule } = req.query;
    if (!matricule) {
        return res.status(400).json({ message: 'Le numéro de matricule est manquant.' });
    }

    let finalResult = null;

    for (const site of SITES_CONFIG) {
        try {
            const formData = new URLSearchParams();
            formData.append(site.matricule_field_name, matricule);

            const response = await axios.post(site.url, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
                },
                timeout: 25000
            });

            const html = response.data;
            const $ = cheerio.load(html);

            const statusElement = $(site.result_selectors.status);
            if (statusElement.length > 0) {
                const statusText = statusElement.first().text().trim().toUpperCase();
                const status = statusText.includes('ADMIS') ? 'ADMIS' : 'REFUSÉ';

                let points = 'N/A';
                const pointsElement = $(site.result_selectors.points);
                if (pointsElement.length > 0) {
                    const pointsText = pointsElement.first().text().trim();
                    const pointsMatch = pointsText.match(/(\d{1,2}[,.]\d{1,2})/);
                    if(pointsMatch) points = pointsMatch[0].replace(',', '.');
                }

                finalResult = { status, points, source: site.nom };
                break;
            }
        } catch (error) {
            console.log(`Échec sur ${site.nom}: ${error.message}`);
        }
    }

    if (finalResult) {
        return res.json(finalResult);
    } else {
        return res.status(404).json({ message: 'Matricule non trouvé. Essayez les liens alternatifs ou vérifiez le matricule.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Le robot est démarré sur le port ${PORT}`);
});

