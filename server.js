const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const SITES_CONFIG = [
    {
        nom: "AGCE-DECO",
        url: "https://agce.exam-deco.org/edit/resultats-examen-bac-2025/",
    },
    {
        nom: "MEN-DECO (Portail)",
        url: "https://www.men-deco.org/",
    },
    {
        nom: "MEN-DECO (Lien direct)",
        url: "https://www.men-deco.org/resultats-bac-2025/",
    },
    {
        nom: "ITDECO",
        url: "https://itdeco.ci/examens/resultat/bac/",
    }
];

app.get('/api/resultat', async (req, res) => {
    const { matricule } = req.query;
    if (!matricule) {
        return res.status(400).json({ message: 'Le numéro de matricule est manquant.' });
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process'
            ]
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
        
        let finalResult = null;

        for (const site of SITES_CONFIG) {
            try {
                await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 30000 });

                const link = await page.$('a[href*="resultat"], a[href*="bac"]');
                if (link) {
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
                        link.click()
                    ]);
                }

                const matriculeInput = await page.$('input[name*="matricule"], input[id*="matricule"], input[placeholder*="matricule"]');
                const submitButton = await page.$('button[type="submit"], input[type="submit"], button:contains("Consulter"), button:contains("Vérifier")');

                if (!matriculeInput || !submitButton) {
                    throw new Error("Formulaire non trouvé.");
                }

                await matriculeInput.type(matricule, { delay: 50 });
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 }),
                    submitButton.click()
                ]);

                const pageContent = await page.content();
                const statusMatch = pageContent.match(/(ADMIS|REFUSÉ|REFUSE)/i);
                
                if (statusMatch) {
                    const status = statusMatch[0].toUpperCase() === 'REFUSE' ? 'REFUSÉ' : statusMatch[0].toUpperCase();
                    const pointsMatch = pageContent.match(/(\d{1,2}[,.]\d{1,2})/);
                    const points = pointsMatch ? pointsMatch[0].replace(',', '.') : 'N/A';
                    
                    finalResult = { status, points, source: site.nom };
                    break;
                }

            } catch (error) {
                console.log(`Échec sur ${site.nom}: ${error.message}`);
            }
        }

        if (finalResult) {
            res.json(finalResult);
        } else {
            res.status(404).json({ message: 'Matricule non trouvé. Essayez les liens alternatifs ou vérifiez le matricule.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Une erreur technique est survenue. Le robot est peut-être surchargé.' });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Le robot est démarré sur le port ${PORT}`);
});