// server.js - Le Robot
// Ce fichier doit être déployé sur un service comme Vercel.

const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
app.use(cors()); // Permet à votre site de parler au robot
app.use(express.json());

// Les 3 sites à vérifier
const SITE_URLS = [
    'https://agce.exam-deco.org/edit/resultats-examen-bac-2025/',
    'https://www.men-deco.org/resultats-bac-2025/',
    'https://itdeco.ci/examens/resultat/bac'
];

// La route que votre site va appeler
app.get('/api/resultat', async (req, res) => {
    const { matricule } = req.query;

    if (!matricule) {
        return res.status(400).json({ message: 'Le numéro de matricule est manquant.' });
    }

    console.log(`Début de la recherche pour le matricule : ${matricule}`);

    // On utilise un navigateur invisible pour le scraping
    // Les options sont pour la compatibilité avec Vercel
    const browser = await puppeteer.launch({ 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();

    let finalResult = null;

    // On essaie chaque site l'un après l'autre
    for (const url of SITE_URLS) {
        try {
            console.log(`Essai sur : ${url}`);
            
            // ================================================================
            // ATTENTION : C'EST LA PARTIE LA PLUS IMPORTANTE À MODIFIER !
            // Vous devrez remplacer les sélecteurs ci-dessous par les vrais
            // sélecteurs des sites officiels une fois qu'ils seront actifs.
            // Utilisez "Inspecter l'élément" dans votre navigateur pour les trouver.
            // ================================================================
            
            const matriculeInputSelector = '#matricule-input-selector'; // <-- À CHANGER
            const submitButtonSelector = '#submit-button-selector'; // <-- À CHANGER
            const resultStatusSelector = '#result-status-selector'; // <-- À CHANGER
            const resultPointsSelector = '#result-points-selector'; // <-- À CHANGER

            await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

            // Remplir le champ du matricule
            await page.type(matriculeInputSelector, matricule);
            
            // Cliquer sur le bouton de recherche
            await page.click(submitButtonSelector);

            // Attendre que le résultat s'affiche
            await page.waitForSelector(resultStatusSelector, { timeout: 10000 });

            // Extraire le statut (ADMIS/REFUSÉ) et les points
            const status = await page.$eval(resultStatusSelector, el => el.textContent.trim());
            const points = await page.$eval(resultPointsSelector, el => el.textContent.trim());

            // Si on a un résultat clair, on le garde
            if (status && (status.toUpperCase().includes('ADMIS') || status.toUpperCase().includes('REFUSÉ'))) {
                finalResult = {
                    status: status.toUpperCase().includes('ADMIS') ? 'ADMIS' : 'REFUSÉ',
                    points: points,
                    source: url
                };
                console.log(`Résultat trouvé sur ${url}!`);
                break; // On a trouvé, on arrête de chercher
            }
        } catch (error) {
            console.log(`Rien trouvé ou erreur sur ${url}: ${error.message}`);
            // On continue au site suivant
        }
    }

    await browser.close(); // On ferme le navigateur invisible

    // On envoie la réponse au site
    if (finalResult) {
        res.json(finalResult);
    } else {
        res.status(404).json({ message: 'Résultat non trouvé. Vérifiez le matricule ou réessayez plus tard.' });
    }
});

app.listen(PORT, () => {
    console.log(`Le robot est démarré sur le port ${PORT}`);
});
