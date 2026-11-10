
# Baobab Dev

**La plateforme d'échange africaine, pour les devs, par les devs.**

Baobab Dev est l'endroit où les développeurs africains se rencontrent, s'entraident, montrent ce qu'ils construisent, collaborent et gagnent leur vie grâce à leur expertise. Le site est conçu pour les conditions réelles du continent : smartphone d'entrée de gamme, réseau 3G, paiements en Mobile Money.

> « Ailleurs, l'IA a vidé les forums de développeurs. Chez nous, elle fait vivre la communauté et récompense ceux qui savent. »

Projet réalisé pour la Coupe d'Afrique des développeurs 2026, d'après le cahier des charges du 29 octobre 2026.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Démarrage rapide](#démarrage-rapide)
- [Variables d'environnement](#variables-denvironnement)
- [Comptes et scénario de démonstration](#comptes-et-scénario-de-démonstration)
- [Structure du projet](#structure-du-projet)
- [Base de données et sécurité](#base-de-données-et-sécurité)
- [Le Griot](#le-griot)
- [Tests](#tests)
- [Déploiement](#déploiement)
- [Feuille de route](#feuille-de-route)

---

## Fonctionnalités

Le site est organisé autour d'une boucle : **aider → construire → être reconnu → gagner**.

### Se rencontrer et échanger

| Fonction | Description | Route |
|---|---|---|
| **Profil gamifié** | Pré-rempli depuis GitHub. On y trouve les XP, 7 niveaux (de Graine à Légende Baobab), des badges bronze, argent et or, un QR code et un bouton de partage WhatsApp. | `/u/[pseudo]`, `/parametres` |
| **Fil personnalisé** | Questions dans tes technologies, projets de ton pays, Squads qui cherchent ton profil, tickets payés, défi de la semaine. | `/fil` |
| **Questions-réponses** | Blocs de code, tags et jusqu'à 4 images. Tu votes, valides la meilleure réponse et commentes. Les questions proches sont suggérées avant publication, et les experts du tag sont notifiés. | `/questions` |
| **Le Griot** | IA communautaire qui répond uniquement à partir des réponses validées. Elle cite leurs auteurs, qui gagnent +5 XP. Disponible dans l'app et sur WhatsApp. | `/griot`, `/griot/whatsapp` |
| **Discussions** | Messages privés entre devs et sujets publics, en temps réel. Avec @mentions, réponses à un message, blocage et signalement. | `/discussions` |
| **Classements** | Par ville, par pays ou sur tout le continent. | `/classements` |

### Construire ensemble

| Fonction | Description | Route |
|---|---|---|
| **Showroom** | Vitrine des projets africains : likes, projet de la semaine, appel à contributeurs. | `/showroom` |
| **Squads** | Équipes formées par matching de compétences, avec candidatures, invitations, tableau de tâches et discussion en temps réel. | `/squads` |
| **Pair-Debugging fantôme** | Débogage à plusieurs façon Google Docs, en texte pur, à moins de 5 Ko/s. Curseurs visibles, terminal partagé, « Prendre la main », secrets masqués et relecture de la session. | `/debug` |
| **Défis** | Défi hebdomadaire noté par un jury. Le podium gagne +100, +60 ou +30 XP. Les défis peuvent être sponsorisés. | `/defis` |
| **Stack Afrique** | Catalogue d'outils africains (paiement, SMS, USSD…). Un outil devient « vérifié » quand 5 devs l'utilisent en production et qu'un modérateur valide sa fiche. Alerte en cas de panne. | `/stack` |
| **Projets à relancer** | Détecteur de projets abandonnés : un projet du Showroom sans commit depuis 6 mois, avec des étoiles ou des forks et des issues sans réponse, est signalé à son propriétaire. Il peut le relancer avec une Squad, le céder à la communauté ou l'archiver. Le repreneur gagne +15 XP ; le fondateur reste crédité et reçoit le badge « Passeur de flambeau ». | `/showroom/relancer` |
| **GitHub vivant** | Activité GitHub publique et carte des 30 derniers jours. Une issue peut devenir un ticket de la Micro-Bourse. | `/activite` |

### Gagner sa vie

| Fonction | Description | Route |
|---|---|---|
| **Micro-Bourse de code** | Bugs et fonctionnalités financés par la communauté. Voir le détail ci-dessous. | `/bourse` |
| **Clone IA du senior** | Dès le niveau Expert, un senior crée un assistant à partir de ses réponses validées et de ses notes. Le clone répond dans son style, cite ses contenus et refuse ce qui sort de sa spécialité. Première question gratuite, puis 100 FCFA, ou Pass Clones à 2 000 FCFA par mois. Le senior touche 70 %. Une mauvaise réponse peut être signalée et remboursée ; sous 2,5/5 de moyenne, le clone est suspendu. | `/clones`, `/clones/mon-clone` |
| **Radar d'opportunités** | Les besoins numériques des PME, ONG et collectivités, publiés sur la plateforme ou collectés dans des flux RSS d'appels d'offres. Le besoin, les technologies, le budget, le délai et le lieu sont extraits automatiquement (Claude, ou règles sans clé). Chaque opportunité reçoit un score de correspondance avec chaque profil et chaque Squad. Au-dessus de 50/100, alerte dans l'app et sur WhatsApp (opt-in). Réponse seul ou au nom de sa Squad ; l'organisation présélectionne et retient. | `/radar`, `/radar/publier` |
| **Code Forensic** | Audit de dette technique avant un lancement ou une levée de fonds. Voir le détail ci-dessous. | `/forensic` |
| **Centrale d'achat** | Coopérative d'infrastructures au prix de gros. Voir le détail ci-dessous. | `/centrale` |
| **Espace recruteurs** | Recherche avancée de profils vérifiés pour les entreprises, ONG et collectivités. Voir le détail ci-dessous. | `/recruteurs`, `/propositions` |
| **Portefeuille** | Solde et historique dans un journal des transactions infalsifiable. En mode test, une recharge fictive permet la démo. | `/portefeuille` |

Fonctionnement de la Micro-Bourse :
- **Création du ticket** : la prime (2 000 FCFA minimum) est bloquée en séquestre dès la création.
- **Abondement** : d'autres devs peuvent ajouter des fonds au ticket.
- **Réservation** : un dev peut réserver le ticket 48 h pour éviter le travail en double.
- **Tests verrouillés** : une Pull Request ne peut pas modifier les tests d'acceptation.
- **Libération** : la prime est versée à la fusion, moins 10 % de commission.
- **Expiration** : sans solution, les contributeurs sont remboursés au prorata.
- **Prolongation** : votée par les contributeurs, pondérée par les montants.
- **Litige** : arbitré par 3 seniors tirés au sort.

Fonctionnement de Code Forensic :
- **Forfait** : 10 000 FCFA minimum, bloqué à la création. Il est remboursé si aucun auditeur n'intervient avant l'échéance.
- **Analyse automatique** d'un dépôt GitHub public : secrets commis, dépendances npm et Composer en retard d'une version majeure, fichiers dupliqués, part de tests, dossiers de dépendances versionnés.
- **Auditeurs** : 3 à 5, de niveau Expert, qui signent un accord de confidentialité électronique. Chaque constat est classé critique, moyen ou mineur, avec une piste de correction.
- **Confrontation** : le porteur conteste un constat, les autres auditeurs tranchent à la majorité (la modération tranche s'il n'y en a pas d'autre).
- **Rapport final** : score sur 100 (critique −15, moyen −6, mineur −2), effort estimé, certificat public vérifiable avec QR code. Les constats peuvent devenir des tickets de la Micro-Bourse.
- **Paiement** : 70 % du forfait partagés entre les auditeurs dont au moins un constat est maintenu. Le porteur note ensuite ses auditeurs.
- **Confidentialité** : en mode confidentiel, le dépôt et les constats ne sont visibles que des parties.

Fonctionnement de la Centrale d'achat :
- **Catalogue négocié** : serveurs cloud, PostgreSQL managé, instance de build, monitoring, passerelle SMS, clé d'API d'IA, nom de domaine. La base refuse toute offre dont la marge sort de 10 à 15 % ou dont le prix dépasse le prix public.
- **En un clic** depuis un projet du Showroom ou une Squad. 5 ressources par compte.
- **Facturation au réel** : à l'heure (tâche planifiée), au SMS ou au millier de jetons. Les crédits offerts sont utilisés avant le portefeuille.
- **Jamais de facture surprise** : plafond mensuel avec alertes à 50, 80 et 100 %, puis pause automatique ; à solde nul, pause plutôt que dette.
- **Clés d'API personnelles** (`bk_…`), dont seule l'empreinte est conservée. Le proxy `/api/centrale/ia/v1/messages` est compatible avec l'API Messages de Claude ; la passerelle `/api/centrale/sms` fonctionne en bac à sable (SMS validés et facturés, pas encore transmis aux opérateurs) et suspend une clé qui dépasse 100 SMS par heure.
- **Coopérative** : les membres votent les prochains services à négocier ; 20 % de la marge annuelle leur revient en crédits, au prorata de leur consommation ; les lauréats des défis et les projets de la semaine reçoivent des crédits.

Fonctionnement de l'espace recruteurs :
- **Abonnement** : 25 000 FCFA pour 30 jours, payés depuis le portefeuille, avec 20 propositions de contact par période. Une prolongation s'ajoute à la fin de la période déjà payée.
- **Profil vérifié** : calculé, jamais déclaré. Il faut un GitHub relié et au moins deux autres familles de preuves : réponses acceptées, Squads menées à terme, primes gagnées, podiums de défi, audits Code Forensic, projets au Showroom. Le badge apparaît aussi sur le profil public.
- **Recherche** : mots-clés, technologies, pays, ville, niveau, disponibilité, type de contrat, vérifiés uniquement. Score sur 100 : compétences demandées (50), preuves (30), réputation (20). Les visiteurs ne voient que des chiffres agrégés.
- **Présélection** avec notes privées, et suivi des propositions avec taux d'acceptation.
- **Le dev garde la main** : il peut se masquer dans `/parametres` et choisir les contrats qui l'intéressent. Un recruteur ne peut pas lui écrire directement : il envoie une proposition, que le dev accepte (la conversation privée s'ouvre avec l'offre en premier message) ou décline, avec une raison s'il le souhaite. Une seule proposition en attente à la fois, pas de relance pendant 30 jours après un refus, expiration au bout de 14 jours. Le blocage s'applique aussi aux recruteurs.
- **Consultations** : le dev voit combien de recruteurs, et lesquels, ont ouvert sa fiche sur 30 jours (une vue par jour et par recruteur), sans le détail ligne par ligne.

### Pensé pour la 3G

- **Accueil léger** : 106 Ko de JavaScript au premier chargement, sans image décorative.
- **PWA installable** : les pages déjà consultées restent lisibles hors connexion, et les brouillons sont gardés sur le téléphone.
- **Mode « données réduites »** : il désactive toutes les photos ; on l'active dans le pied de page.
- **Images compressées dans le navigateur** avant l'envoi, en WebP 1 600 px (environ 150 Ko au lieu de plusieurs Mo).
- **Utilisable dès 360 px de large.**

### Communauté et modération

- **Notifications en temps réel** : badges débloqués affichés à l'écran, citations du Griot, primes versées, mentions, messages privés.
- **Espace modération** : signalements, sanctions (−15 XP), litiges, validation de la Stack Afrique, statistiques. Route : `/moderation`.
- **Anti-triche** :
  - plafond quotidien d'XP issus des votes ;
  - poids réduit des comptes de moins de 7 jours ;
  - interdiction de voter pour soi ;
  - limite de 20 messages par minute.

---

## Stack technique

| Couche | Choix |
|---|---|
| Front-end | [Next.js 15](https://nextjs.org) (App Router, Server Components, Server Actions), React 19, Tailwind CSS 4, PWA |
| Back-end et données | [Supabase](https://supabase.com) : PostgreSQL 17, Auth, Realtime, Storage |
| Recherche sémantique | pgvector (embeddings Voyage, 1024 dimensions), avec repli sur la recherche plein texte PostgreSQL |
| IA | API Claude (`@anthropic-ai/sdk`) pour le Griot |
| Temps réel | Supabase Realtime (changements de la base, broadcast, présence) |
| Intégrations | WhatsApp Business Cloud API, webhooks GitHub, Vercel Cron |
| Paiements (V1) | FedaPay, Kkiapay ou CinetPay : prévu, pas encore branché (le séquestre fonctionne en mode test) |

---

## Démarrage rapide

### Prérequis

- Node.js 22 ou plus récent
- Docker Desktop, lancé

### Installation

```bash
cd baobab-dev
npm install

# 1. Démarrer Supabase en local (base, auth, temps réel, stockage)
#    La première fois, le téléchargement des images Docker peut être long.
npx supabase start

# 2. Configurer l'environnement
cp .env.example .env.local
#    Copier dans .env.local l'URL, l'anon key et la service_role key affichées par :
npx supabase status

# 3. Lancer le site
npm run dev
```

Le site est sur **http://localhost:3000**, et l'interface d'administration de la base (Supabase Studio) sur **http://127.0.0.1:57323**.

Les migrations et les données de démo sont appliquées au démarrage. Pour repartir d'une base propre :

```bash
npx supabase db reset
```

### Si le téléchargement des images Docker échoue

Le registre public d'images de Supabase limite parfois les téléchargements (erreur `toomanyrequests`). Dans ce cas, récupère les images sur Docker Hub et démarre sans les services dont le site n'a pas besoin :

```bash
SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start \
  -x imgproxy,mailpit,edge-runtime,logflare,vector,supavisor
```

### Commandes utiles

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` puis `npm start` | Version de production (nécessaire pour tester le mode hors ligne) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Vérification des types |
| `npm run test:e2e` | Tests de bout en bout (voir [Tests](#tests)) |
| `npm run db:reset` | Réinitialise la base (migrations et données de démo) et attend que l'API réponde |
| `npx supabase stop` | Arrête Supabase |

---

## Variables d'environnement

Toutes les variables sont listées dans [.env.example](.env.example). Seules les trois premières sont nécessaires pour faire tourner le site en local.

| Variable | Obligatoire | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | oui | URL de l'API Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | oui | Clé publique : toutes les requêtes passent par la sécurité par ligne de PostgreSQL (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | oui | Clé serveur, réservée aux webhooks, au Griot et au mode test. Ne jamais l'exposer au navigateur. |
| `NEXT_PUBLIC_APP_URL` | non | URL publique du site (liens et QR codes) |
| `NEXT_PUBLIC_DEMO_ACCOUNTS` | non | `false` masque les comptes de démo sur `/login` |
| `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID` / `_SECRET` | pour GitHub | Identifiants de l'OAuth App GitHub, à mettre dans `supabase/.env` (fichier lu par le CLI Supabase, pas par Next.js) |
| `ANTHROPIC_API_KEY` | non | Synthèse du Griot par Claude. Sans clé, il assemble des extraits des réponses, toujours sourcés. |
| `VOYAGE_API_KEY` | non | Recherche sémantique (Griot et clones). Sans clé, ou si Voyage refuse la requête, l'app utilise la recherche plein texte. Sans moyen de paiement enregistré chez Voyage, le compte est limité à 3 requêtes par minute (les tokens offerts restent gratuits). Après un `db:reset`, lance `npm run embed:backfill` pour indexer les contenus de démo. |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | pour WhatsApp | Le Griot sur WhatsApp (webhook `/api/whatsapp`) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | non | Numéro affiché sur la page du Griot |
| `GITHUB_WEBHOOK_SECRET`, `GITHUB_TOKEN` | pour la Micro-Bourse réelle | Webhook `/api/github/webhook` : résultat des tests et fusion des Pull Requests |
| `CRON_SECRET` | pour la tâche quotidienne | Protège `/api/cron` |

### Connexion GitHub

1. Crée une OAuth App sur GitHub : *Settings → Developer settings → OAuth Apps*.
2. Indique comme adresse de retour (*Authorization callback URL*) `http://127.0.0.1:57321/auth/v1/callback` en local, ou celle de ton projet Supabase en production.
3. Crée le fichier `supabase/.env` (il est ignoré par git) :
   ```bash
   SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=<client id>
   SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=<secret>
   ```
4. Dans `supabase/config.toml`, passe `enabled = true` dans la section `[auth.external.github]`, puis redémarre Supabase (`npx supabase stop` puis `npx supabase start`).

### Webhooks en local

GitHub et Meta (WhatsApp) doivent pouvoir joindre l'app : ouvre un tunnel avec `npx cloudflared tunnel --url http://localhost:3000`, puis déclare les adresses `https://<tunnel>/api/github/webhook` et `https://<tunnel>/api/whatsapp`. L'adresse change à chaque lancement du tunnel : mets à jour les webhooks en conséquence. Les secrets à saisir chez GitHub et Meta sont `GITHUB_WEBHOOK_SECRET` et `WHATSAPP_VERIFY_TOKEN` de `.env.local`.

---

## Comptes et scénario de démonstration

### Comptes de démo

Tous ont le mot de passe **`baobab2026`**. Sur `/login`, des boutons permettent de s'y connecter en un clic.

| Compte | Profil |
|---|---|
| `aicha@baobab.dev` | Aïcha, dev Laravel à Cotonou (Jeune Baobab) |
| `koffi@baobab.dev` | Koffi, senior PHP à Abidjan (Expert) : arbitre les litiges |
| `moussa@baobab.dev` | Moussa, dev fullstack à Dakar |
| `fatou@baobab.dev` | Fatou, dev Flutter à Lomé |
| `ibrahim@baobab.dev` | Ibrahim, étudiant à Ouagadougou |
| `modo@baobab.dev` | Équipe de modération (administrateur) |
| `mairie@baobab.dev` | Mairie de Cotonou (compte organisation) : publie des besoins sur le Radar, abonnée à l'espace recruteurs (une présélection, une proposition en attente auprès de Koffi) |

Les données de démo comprennent :
- des questions avec leurs réponses ;
- trois projets et deux Squads ;
- un ticket de la Micro-Bourse en séquestre ;
- un défi en cours ;
- trois outils de la Stack Afrique ;
- trois sujets de discussion et une conversation privée.

### Scénario en 3 minutes (critères d'acceptation, §12.4)

Ouvre deux navigateurs, l'un connecté en **Aïcha** et l'autre en **Koffi**.

1. **Inscription** : sur `/login`, connexion GitHub. Le profil est pré-rempli avec les langages des dépôts publics.
2. **Le Griot sur WhatsApp** : Aïcha ouvre `/griot/whatsapp` et demande « Comment intégrer FedaPay dans Laravel ? ». Le Griot cite Koffi, qui reçoit en direct la notification « +5 XP ».
3. **Ticket financé** : Aïcha crée un ticket à 25 000 FCFA sur `/bourse/new`. Moussa ajoute des fonds depuis la page du ticket.
4. **Pair-Debugging** : Aïcha lance une session sur `/debug` et partage le lien. Koffi la rejoint, et le débit s'affiche en Ko/s.
5. **Libération** : Koffi soumet sa Pull Request et clique sur « Simuler : tests OK ». Aïcha clique sur « Fusionner et libérer » : Koffi reçoit la cagnotte moins 10 % de commission (27 000 FCFA si Moussa a ajouté 5 000 FCFA). En production, le webhook GitHub fait la même chose automatiquement.
6. **Badge** : Koffi voit apparaître « Badge débloqué : Chasseur de primes », et le badge s'affiche sur son profil.

---

## Structure du projet

```
baobab-dev/
├── src/
│   ├── app/                    # Routes (App Router)
│   │   ├── api/                # griot, whatsapp, github/webhook, cron
│   │   ├── bourse/             # Micro-Bourse et portefeuille
│   │   ├── debug/              # Pair-Debugging (DebugRoom : protocole texte)
│   │   ├── discussions/        # Messages privés et sujets (ChatRoom temps réel)
│   │   ├── griot/              # Le Griot (app et démo WhatsApp)
│   │   ├── questions/          # Q&A
│   │   ├── squads/  showroom/  defis/  stack/  classements/  fil/
│   │   ├── u/[username]/       # Profils publics
│   │   └── layout.tsx          # En-tête, pied de page, mode données réduites
│   ├── components/             # Avatar, Markdown, ImageUploader, LiveNotifications…
│   ├── lib/
│   │   ├── supabase/           # Clients navigateur, serveur, admin et middleware
│   │   ├── griot.ts            # Recherche, synthèse Claude et citations
│   │   ├── github.ts           # Import du profil GitHub
│   │   └── …                   # niveaux, libellés, notifications, formatage
│   └── middleware.ts           # Rafraîchissement de la session
├── supabase/
│   ├── migrations/             # Schéma, fonctions, RLS (un fichier par lot de fonctionnalités)
│   ├── seed.sql                # Comptes et contenu de démo
│   └── config.toml
├── public/                     # sw.js (service worker), icônes
├── tests/e2e/                  # Tests de bout en bout
└── vercel.json                 # Planification de la tâche quotidienne
```

---

## Base de données et sécurité

Toute la logique sensible (points, argent, badges) vit **dans PostgreSQL**, et non dans le code de l'application. Ainsi, aucune requête ne peut tricher en contournant l'interface.

- **Sécurité par ligne (RLS) sur toutes les tables.** Chaque utilisateur ne peut modifier que certaines colonnes de ses propres lignes. Il ne peut donc changer lui-même ni son XP, ni son rôle, ni le score d'une réponse.
- **Fonctions `security definer`** pour toutes les opérations sensibles. Elles vérifient l'utilisateur appelant :
  - la Micro-Bourse : `create_bounty`, `release_bounty`… ;
  - les XP : `add_points` ;
  - les badges : `award_badge` ;
  - l'arbitrage : `vote_dispute`.
- **Argent** :
  - les mouvements ne passent que par `wallet_move` ;
  - le journal des transactions est **en ajout seul** : toute modification ou suppression est refusée ;
  - chaque ligne est **chaînée à la précédente par une empreinte SHA-256**.
- **Micro-Bourse** :
  - le créateur ne peut pas résoudre son propre ticket ;
  - une PR qui modifie les tests d'acceptation est rejetée ;
  - seul le webhook GitHub, qui utilise la clé serveur, peut marquer des tests comme passés.
- **Webhooks** (GitHub, WhatsApp) : leur signature HMAC est vérifiée. La tâche quotidienne est protégée par `CRON_SECRET`.
- **Fichiers** : chacun ne dépose que dans son dossier ; seules les images sont acceptées, avec 1 Mo maximum.
- **Pair-Debugging** : les secrets (`.env`, clés d'API, jetons JWT) sont masqués sur la machine de l'hôte, avant tout envoi.

Les migrations de [supabase/migrations/](supabase/migrations/), dans l'ordre :

| Migration | Contenu |
|---|---|
| `…_init.sql` | Profils, gamification, Q&A, Griot, Showroom, Squads, portefeuille, Micro-Bourse, Pair-Debugging, RLS |
| `…_features.sql` | Recherche plein texte, notifications automatiques, matching, fil, classements, modération |
| `…_v1.sql` | Défis, Stack Afrique, expiration, prolongation et arbitrage de la Micro-Bourse |
| `…_question_images.sql`, `…_answer_images.sql` | Stockage des images |
| `…_discussions.sql` | Messages privés, sujets, blocage, anti-spam |
| `…_code_forensic.sql` | Audits, auditeurs et accord de confidentialité, constats, votes, score, clôture et paiement, expiration |
| `…_abandoned_projects.sql` | Statistiques des dépôts, détection, choix du propriétaire, cession et reprise |
| `…_radar.sql` | Opportunités, score de correspondance, alertes, réponses, sources de collecte, alertes WhatsApp |
| `…_centrale.sql` | Centrale d'achat : catalogue, ressources, facturation, crédits, plafonds, anti-spam, coopérative ; correctif d'accès aux XP et badges |
| `…_recruiters.sql` | Espace recruteurs : abonnement, preuves et statut vérifié, recherche, présélection, propositions consenties, consultations |
| `…_ai_clones.sql` | Clones IA : sources, facturation 70/30, Pass Clones et répartition mensuelle, avis, remboursement, suspension |

---

## Le Griot

Le Griot ne remplace pas les devs : il s'appuie sur leurs réponses, les cite et les récompense.

1. **Recherche** : il cherche les réponses validées ou bien notées les plus proches de la question, par similarité sémantique (pgvector) ou, sans clé Voyage, par recherche plein texte.
2. **Synthèse** : Claude (`claude-opus-5-5`, effort `low` pour répondre en moins de 8 s) rédige la réponse uniquement à partir de ces sources, en les numérotant `[1]`, `[2]`…
3. **Contrôle** : une réponse sans citation valide est remplacée par un assemblage d'extraits des sources. 100 % des réponses sont donc sourcées.
4. **Récompense** : chaque auteur cité gagne +5 XP et une notification. Le badge « Voix du Griot » se débloque à 10 citations.
5. **Sans source fiable**, le Griot n'invente rien : il propose de publier la question, et les experts sont notifiés.

Le Griot est gratuit, dans la limite de 20 questions par jour.

---

## Tests

Les tests de bout en bout tournent contre Supabase local et le serveur de développement. Ils utilisent les vrais comptes de démo et vérifient aussi les règles de sécurité (RLS, anti-fraude, anti-spam).

```bash
npx supabase start
npm run dev          # dans un autre terminal
npm run test:e2e     # réinitialise la base avant chaque suite, puis à la fin
```

| Suite | Couvre |
|---|---|
| [tests/e2e/mvp.mjs](tests/e2e/mvp.mjs) | Les 6 étapes du scénario de démonstration, le séquestre, la commission, les badges, le journal chaîné |
| [tests/e2e/v1.mjs](tests/e2e/v1.mjs) | Défis, Stack Afrique, prolongation, litiges, expiration et remboursements, PWA |
| [tests/e2e/images.mjs](tests/e2e/images.mjs) | Envoi d'images, droits sur le stockage, limites, affichage en mode données réduites |
| [tests/e2e/discussions.mjs](tests/e2e/discussions.mjs) | Messages privés, temps réel, non-lus, mentions, blocage, modération, anti-spam |
| [tests/e2e/forensic.mjs](tests/e2e/forensic.mjs) | Code Forensic : confidentialité, recrutement, contestation et vote, clôture, paiement, certificat, analyse d'un vrai dépôt, remboursement |
| [tests/e2e/abandoned.mjs](tests/e2e/abandoned.mjs) | Projets abandonnés : règles de détection, relance, archivage, cession et reprise, vérification d'un vrai dépôt |
| [tests/e2e/radar.mjs](tests/e2e/radar.mjs) | Radar : scores, alertes, confidentialité, réponses, collecte d'un flux RSS local avec extraction et déduplication |
| [tests/e2e/centrale.mjs](tests/e2e/centrale.mjs) | Centrale d'achat : marges, clés d'API, SMS et anti-spam, facturation horaire, crédits, plafond et pause, solde, quota, ristourne, proxy d'IA |
| [tests/e2e/recruteurs.mjs](tests/e2e/recruteurs.mjs) | Espace recruteurs : accès réservé, filtres et score, profils masqués et blocage, vues agrégées, prolongations, propositions (acceptation, refus, relance, quota, expiration), revenus |
| [tests/e2e/clones.mjs](tests/e2e/clones.mjs) | Clone IA : réponses sourcées, facturation, répétitions, Pass, remboursement, suspension, création et publication |

Une suite seule : `npm run db:reset && node tests/e2e/clones.mjs`.

---

## Déploiement

1. **Base de données** : crée un projet sur [supabase.com](https://supabase.com), puis applique les migrations depuis ton poste :
   ```bash
   npx supabase link --project-ref <ref-du-projet>
   npx supabase db push
   ```
   N'exécute pas `seed.sql` en production : il crée les comptes de démo.
2. **Site** : déploie le dossier `baobab-dev/` sur [Vercel](https://vercel.com), puis renseigne les variables d'environnement du projet.
3. **Réglages de production** :
   - mettre `NEXT_PUBLIC_DEMO_ACCOUNTS=false` ;
   - passer `payments_mode` à `"live"` dans la table `app_settings`, une fois un prestataire de paiement agréé branché.
4. **Tâche quotidienne** : `vercel.json` planifie `/api/cron` chaque matin. Vercel transmet automatiquement `CRON_SECRET`.
5. **Webhooks** :
   - GitHub : `https://<domaine>/api/github/webhook`, avec les événements `workflow_run` et `pull_request` ;
   - WhatsApp : `https://<domaine>/api/whatsapp`.

---

## Feuille de route

| Phase | État | Contenu |
|---|---|---|
| **MVP (P1)** | ✅ fait | Inscription, profil gamifié, Q&A, Showroom, Squads, Griot (avec démo WhatsApp), Pair-Debugging, Micro-Bourse en mode test, modération |
| **V1 (P2)** | 🟡 en partie | ✅ Défis, Stack Afrique, GitHub vivant, Micro-Bourse complète, PWA hors ligne, images, discussions<br>⬜ Connexion Google et OTP SMS, paiements Mobile Money réels, notifications WhatsApp et email, traduction anglais, webhooks GitHub en temps réel, correction automatique des défis |
| **V2 (P3)** | ✅ fait | Clone IA du senior, Code Forensic, détecteur de projets abandonnés, Radar d'opportunités, Centrale d'achat d'infrastructures, espace recruteurs |

Pour le Pair-Debugging, il reste à faire l'extension VS Code et le client en ligne de commande. Le protocole texte qu'ils utiliseront est déjà en place.

---

*Cahier des charges : [`../Cahier des charges — Baobab Dev.docx`](../Cahier%20des%20charges%20—%20Baobab%20Dev.docx)*
