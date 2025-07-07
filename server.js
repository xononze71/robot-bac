const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

// Configuration CORS permissive
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: false
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration des sites optimisée
const SITES_CONFIG = [
    {
        nom: "AGCE-DECO",
        url: "https://agce.exam-deco.org/edit/resultats-examen-bac-2025/",
        matricule_field_name: "matricule",
        method: "POST",
        result_selectors: {
            status: ["h3.text-success", "h3.text-danger", ".result-status", ".status"],
            points: ["p.total-points", ".points", ".result-points", ".score"]
        }
    },
    {
        nom: "ITDECO",
        url: "https://itdeco.ci/examens/resultat/bac/",
        matricule_field_name: "matricule",
        method: "POST",
        result_selectors: {
            status: ["#resultat_div .statut", ".statut", ".result-status", ".status"],
            points: ["#resultat_div .points", ".points", ".result-points", ".score"]
        }
    },
    {
        nom: "MEN-DECO (Portail)",
        url: "https://www.men-deco.org/",
        matricule_field_name: "search_matricule",
        method: "POST",
        result_selectors: {
            status: [".result-status", ".status", "h3.text-success", "h3.text-danger"],
            points: [".result-points", ".points", ".score"]
        }
    },
    {
        nom: "MEN-DECO (Direct)",
        url: "https://www.men-deco.org/resultats-bac-2025/",
        matricule_field_name: "matricule_field",
        method: "POST",
        result_selectors: {
            status: ["div.status-admis", "div.status-refuse", ".result-status", ".status"],
            points: ["span.points-obtenus", ".points", ".result-points", ".score"]
        }
    }
];

// Headers par défaut pour les requêtes
const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
};

// Fonction pour extraire le statut
function extractStatus(html, selectors) {
    const $ = cheerio.load(html);
    
    for (const selector of selectors) {
        const element = $(selector);
        if (element.length > 0) {
            const text = element.first().text().trim().toUpperCase();
            if (text.includes('ADMIS')) return 'ADMIS';
            if (text.includes('REFUSE') || text.includes('REFUSÉ') || text.includes('ÉCHEC')) return 'REFUSÉ';
        }
    }
    return null;
}

// Fonction pour extraire les points
function extractPoints(html, selectors) {
    const $ = cheerio.load(html);
    
    for (const selector of selectors) {
        const element = $(selector);
        if (element.length > 0) {
            const text = element.first().text().trim();
            const pointsMatch = text.match(/(\d{1,2}[,.]\d{1,2})/);
            if (pointsMatch) {
                return pointsMatch[0].replace(',', '.');
            }
        }
    }
    return 'N/A';
}

// Fonction pour scraper un site
async function scrapeSite(site, matricule) {
    try {
        console.log(`[${site.nom}] Tentative de scraping pour matricule: ${matricule}`);
        
        const formData = new URLSearchParams();
        formData.append(site.matricule_field_name, matricule);
        
        const config = {
            method: site.method,
            url: site.url,
            headers: {
                ...DEFAULT_HEADERS,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: formData.toString(),
            timeout: 20000,
            maxRedirects: 5,
            validateStatus: (status) => status < 500
        };
        
        const response = await axios(config);
        
        if (response.status >= 400) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = response.data;
        
        // Extraction du statut
        const status = extractStatus(html, site.result_selectors.status);
        
        if (status) {
            const points = extractPoints(html, site.result_selectors.points);
            console.log(`[${site.nom}] Résultat trouvé: ${status} - ${points} points`);
            
            return {
                status: status,
                points: points,
                source: site.nom,
                success: true
            };
        }
        
        console.log(`[${site.nom}] Aucun résultat trouvé`);
        return { success: false, message: 'Aucun résultat trouvé' };
        
    } catch (error) {
        console.error(`[${site.nom}] Erreur:`, error.message);
        return { 
            success: false, 
            message: error.message,
            error: error.code || 'UNKNOWN_ERROR'
        };
    }
}

// Route principale
app.get('/api/resultat', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { matricule } = req.query;
        
        if (!matricule) {
            return res.status(400).json({ 
                message: 'Le numéro de matricule est requis.',
                error: 'MISSING_MATRICULE'
            });
        }
        
        const cleanMatricule = matricule.trim().toUpperCase();
        
        if (cleanMatricule.length < 3) {
            return res.status(400).json({ 
                message: 'Le numéro de matricule doit contenir au moins 3 caractères.',
                error: 'INVALID_MATRICULE'
            });
        }
        
        console.log(`\n🔍 Recherche pour matricule: ${cleanMatricule}`);
        
        let finalResult = null;
        const errors = [];
        
        // Parcourir tous les sites
        for (const site of SITES_CONFIG) {
            const result = await scrapeSite(site, cleanMatricule);
            
            if (result.success) {
                finalResult = result;
                break;
            } else {
                errors.push(`${site.nom}: ${result.message}`);
            }
        }
        
        const processingTime = Date.now() - startTime;
        console.log(`⏱️ Temps de traitement: ${processingTime}ms`);
        
        if (finalResult) {
            console.log(`✅ Résultat trouvé sur ${finalResult.source}`);
            return res.json({
                status: finalResult.status,
                points: finalResult.points,
                source: finalResult.source,
                processingTime: processingTime
            });
        } else {
            console.log(`❌ Aucun résultat trouvé`);
            return res.status(404).json({
                message: 'Matricule non trouvé sur les sites officiels. Vérifiez le numéro ou essayez plus tard.',
                suggestion: 'Utilisez les liens alternatifs pour une recherche manuelle.',
                errors: errors,
                processingTime: processingTime
            });
        }
        
    } catch (error) {
        console.error('Erreur serveur:', error);
        return res.status(500).json({
            message: 'Erreur interne du serveur. Veuillez réessayer.',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
});

// Route de test
app.get('/api/test', (req, res) => {
    res.json({
        message: 'Robot BAC 2025 - Fonctionnel ✅',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        sites: SITES_CONFIG.map(site => ({
            nom: site.nom,
            url: site.url,
            status: 'Actif'
        }))
    });
});

// Route par défaut
app.get('/', (req, res) => {
    res.json({
        message: 'API Robot BAC 2025 - Côte d\'Ivoire',
        version: '2.0.0',
        endpoints: [
            'GET /api/test - Test du robot',
            'GET /api/resultat?matricule=XXX - Recherche de résultat'
        ]
    });
});

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).json({
        message: 'Endpoint non trouvé',
        error: 'NOT_FOUND'
    });
});

// Gestion des erreurs globales
app.use((error, req, res, next) => {
    console.error('Erreur non gérée:', error);
    res.status(500).json({
        message: 'Erreur interne du serveur',
        error: 'INTERNAL_SERVER_ERROR'
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Robot BAC 2025 démarré sur le port ${PORT}`);
    console.log(`📡 API disponible sur: http://localhost:${PORT}`);
    console.log(`🔧 Test: http://localhost:${PORT}/api/test`);
});

module.exports = app;