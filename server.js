const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const TARGET_SITE = {
    nom: "ITDECO",
    url: "https://itdeco.ci/examens/resultat/bac/redis/",
    matricule_field_name: "matricule",
    result_selectors: {
        status: "#resultat_div .statut, .result-status, h3",
        points: "#resultat_div .points, .result-points, .points-total"
    }
};

app.get('/api/resultat', async (req, res) => {
    const { matricule } = req.query;
    if (!matricule) {
        return res.status(400).json({ message: 'Le numéro de matricule est manquant.' });
    }

    try {
        const formData = new URLSearchParams();
        formData.append(TARGET_SITE.matricule_field_name, matricule);

        const response = await axios.post(TARGET_SITE.url, formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
            },
            timeout: 30000
        });

        const html = response.data;
        const $ = cheerio.load(html);

        const statusElement = $(TARGET_SITE.result_selectors.status);
        if (statusElement.length > 0) {
            const statusText = statusElement.first().text().trim().toUpperCase();
            const status = statusText.includes('ADMIS') ? 'ADMIS' : 'REFUSÉ';

            let points = 'N/A';
            const pointsElement = $(TARGET_SITE.result_selectors.points);
            if (pointsElement.length > 0) {
                const pointsText = pointsElement.first().text().trim();
                const pointsMatch = pointsText.match(/(\d{1,2}[,.]\d{1,2})/);
                if (pointsMatch) points = pointsMatch[0].replace(',', '.');
            }

            return res.json({ status, points, source: TARGET_SITE.nom });
        } else {
            return res.status(404).json({ message: 'Matricule non trouvé. Essayez le lien alternatif ou vérifiez le numéro.' });
        }
    } catch (error) {
        console.error(`Échec sur ${TARGET_SITE.nom}:`, error.message);
        return res.status(500).json({ message: 'Une erreur technique est survenue. Le site officiel est peut-être surchargé.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Le robot est démarré sur le port ${PORT}`);
});

