const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

// Configuration CORS plus permissive
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: false
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration des sites avec sélecteurs améliorés
const SITES_CONFIG = [
    {
        nom: "AGCE-DECO",
        url: "https://agce.exam-deco.org/edit/resultats-examen-bac-2025/",
        matricule_field_name: "matricule",
        method: "POST",
        result_sel