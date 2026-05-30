# Estelle Castero — Site vitrine

Portfolio personnel d'Estelle Castero, étudiante en communication & marketing.
Site statique, 100 % artisanal : **HTML / CSS / JavaScript** sans aucune
dépendance ni build. Léger, rapide, hébergeable partout.

## ▶️ Voir le site

Aucune installation nécessaire. Deux options :

1. **Le plus simple** — double-clique sur `index.html`, il s'ouvre dans ton navigateur.
2. **Recommandé** (pour que tout marche parfaitement, polices comprises) —
   lance un petit serveur local depuis ce dossier :

   ```bash
   # avec Python (déjà installé sur la plupart des PC/Mac)
   python -m http.server 8000
   ```

   Puis ouvre http://localhost:8000 dans ton navigateur.

## 📁 Structure

```
estelle-vitrine/
├── index.html        → le contenu et la structure des sections
├── css/style.css     → tout le design, les thèmes clair/sombre, le responsive
├── js/main.js        → les animations (curseur, reveal, compteurs, thème…)
├── assets/           → favicon et futurs médias
└── README.md
```

## ✨ Ce qu'il contient

- **Préchargeur** animé avec le prénom qui se révèle
- **Curseur personnalisé** + boutons « magnétiques » (desktop)
- **Mode clair / sombre** mémorisé (bouton en haut à droite)
- Titres qui se **dévoilent** au défilement, mot qui tourne dans le hero
- **Compteurs animés**, effet de **tilt 3D** sur les cartes
- Bandeau **marquee** défilant, **parallaxe** sur le hero
- Entièrement **responsive** (menu plein écran sur mobile)
- Respecte « `prefers-reduced-motion` » (accessibilité)

## 🛠️ Personnaliser

| Tu veux changer…            | Va dans…                                   |
|-----------------------------|--------------------------------------------|
| Les couleurs                | `css/style.css` → bloc `:root` (tout en haut) |
| Les textes / sections       | `index.html`                               |
| L'email & les réseaux       | `index.html` → section `#contact`          |
| Ta photo                    | remplace le bloc `.about__portrait-placeholder` par une `<img>` |

### Ajouter tes projets

Dans `index.html`, section `#projets`, duplique un bloc `<article class="project">`
et remplace le placeholder par ton image :

```html
<div class="project__media">
  <img src="assets/mon-projet.jpg" alt="Description du projet" />
</div>
```

## 🚀 Mettre en ligne (quand tu seras prête)

Glisse simplement le dossier sur **Netlify** (drag & drop), **Vercel**, ou
active **GitHub Pages**. C'est un site statique : aucune configuration serveur.

---

Fait main, pensé pour évoluer avec tes projets. 🌅
