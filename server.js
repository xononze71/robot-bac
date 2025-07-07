// server.js - Le Robot Final (Version Intelligente et Professionnelle)
// Ce robot est conçu pour être autonome et s'adapter aux pages.

const express = require('express');
const puppeteer = require('puppeteer');
const cors =require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// La liste des 4 sites à vérifier, avec leur type
const SITES_A_VERIFIER = [
    {
        nom: "ITDECO",
        url: "https://itdeco.ci/examens/resultat/bac/",
        type: "direct" // Ce site est direct
    },
    {
        nom: "AGCE-DECO",
        url: "https://agce.exam-deco.org/edit/resultats-examen-bac-2025/",
        type: "direct" // Ce site est direct
    },
    {
        nom: "MEN-DECO (Portail)",
        url: "https://www.men-deco.org/",
        type: "indirect" // Ce site nécessite de trouver un lien
    },
    {
        nom: "MEN-DECO (Lien direct)",
        url: "https://www.men-deco.org/resultats-bac-2025/",
        type: "direct" // Un autre lien direct, au cas où
    }
];

// Le robot va essayer de deviner le bon champ pour le matricule
async function findMatriculeInput(page) {
    const selectors = [
        'input[name*="matricule"]',
        'input[id*="matricule"]',
        'input[placeholder*="matricule"]',
        'input[type="text"]',
        'input[type="search"]'
    ];
    for (const selector of selectors) {
        try {
            const element = await page.waitForSelector(selector, { timeout: 1000 });
            if (element) return selector;
        } catch (e) { /* ignore */ }
    }
    return null;
}

// Le robot va essayer de deviner le bon bouton pour valider
async function findSubmitButton(page) {
    const selectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Vérifier")',
        'button:has-text("Consulter")',
        'button:has-text("Rechercher")'
    ];
     for (const selector of selectors) {
        try {
            const element = await page.waitForSelector(selector, { timeout: 1000 });
            if (element) return selector;
        } catch (e) { /* ignore */ }
    }
    return null;
}

app.get('/api/resultat', async (req, res) => {
    const { matricule } = req.query;

    if (!matricule) {
        return res.status(400).json({ message: 'Le numéro de matricule est manquant.' });
    }

    console.log(`Début de la recherche pour le matricule : ${matricule}`);
    const browser = await puppeteer.launch({ 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    let finalResult = null;

    for (const site of SITES_A_VERIFIER) {
        try {
            console.log(`--- Essai sur le site : ${site.nom} ---`);
            await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 25000 });

            if (site.type === 'indirect') {
                console.log("Site indirect détecté. Recherche d'un lien pertinent...");
                // Le robot cherche un lien <a> qui contient le mot "résultat" ou "bac"
                const link = await page.waitForSelector('a[href*="resultat"], a:has-text("résultat"), a:has-text("BAC")', { timeout: 15000 });
                await link.click();
                console.log("Lien trouvé et cliqué. Attente de la nouvelle page...");
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
            }

            console.log("Recherche intelligente des champs sur la page...");
            const matriculeSelector = await findMatriculeInput(page);
            const boutonSelector = await findSubmitButton(page);

            if (!matriculeSelector || !boutonSelector) {
                throw new Error("Impossible de trouver le formulaire sur la page.");
            }
            
            console.log(`Champ trouvé : ${matriculeSelector}. Bouton trouvé : ${boutonSelector}.`);
            await page.type(matriculeSelector, matricule);
            await page.click(boutonSelector);

            console.log("Attente du résultat...");
            // Le robot attend un élément qui contient "ADMIS" ou "REFUSÉ"
            const resultatElement = await page.waitForSelector('*:has-text("ADMIS"), *:has-text("REFUSÉ")', { timeout: 20000 });
            
            console.log("Résultat détecté. Lecture des informations...");
            const pageContent = await page.evaluate(() => document.body.innerText);
            
            const status = pageContent.includes('ADMIS') ? 'ADMIS' : 'REFUSÉ';
            // Tente de trouver des points (chiffres avec une virgule ou un point)
            const pointsMatch = pageContent.match(/(\d{1,2}[,.]\d{1,2})/);
            const points = pointsMatch ? pointsMatch[0].replace(',', '.') : 'N/A';

            finalResult = { status, points, source: site.nom };
            console.log(`SUCCÈS ! Résultat trouvé sur ${site.nom}!`);
            break;

        } catch (error) {
            console.log(`ÉCHEC ou erreur sur ${site.nom}: ${error.message}`);
        }
    }

    await browser.close();

    if (finalResult) {
        res.json(finalResult);
    } else {
        res.status(404).json({ message: 'Résultat non trouvé. Vérifiez le matricule ou réessayez plus tard.' });
    }
});

app.listen(PORT, () => {
    console.log(`Le robot est démarré sur le port ${PORT}`);
});