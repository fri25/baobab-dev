-- Badges (§5.7) : bronze, argent et or par catégorie
insert into public.badges (code, name, category, tier, description) values
  ('sage_village_bronze',    'Sage du Village',      'entraide',      'bronze', 'Première réponse validée'),
  ('sage_village_argent',    'Sage du Village',      'entraide',      'argent', '25 réponses validées'),
  ('sage_village_or',        'Sage du Village',      'entraide',      'or',     '100 réponses validées'),
  ('batisseur_bronze',       'Bâtisseur',            'construction',  'bronze', 'Premier projet publié dans le Showroom'),
  ('batisseur_argent',       'Bâtisseur',            'construction',  'argent', 'Projet de la semaine'),
  ('batisseur_or',           'Bâtisseur',            'construction',  'or',     '3 fois projet de la semaine'),
  ('esprit_equipe_bronze',   'Esprit d''équipe',     'collaboration', 'bronze', 'Première Squad terminée'),
  ('esprit_equipe_argent',   'Esprit d''équipe',     'collaboration', 'argent', '5 Squads terminées'),
  ('esprit_equipe_or',       'Esprit d''équipe',     'collaboration', 'or',     '15 Squads terminées'),
  ('chasseur_primes_bronze', 'Chasseur de primes',   'economie',      'bronze', 'Premier ticket de la Micro-Bourse résolu'),
  ('chasseur_primes_argent', 'Chasseur de primes',   'economie',      'argent', '10 tickets résolus'),
  ('chasseur_primes_or',     'Chasseur de primes',   'economie',      'or',     '50 tickets résolus'),
  ('mecene_code_bronze',     'Mécène du code',       'economie',      'bronze', 'Premier abondement à un ticket'),
  ('mecene_code_argent',     'Mécène du code',       'economie',      'argent', '100 000 FCFA abondés'),
  ('mecene_code_or',         'Mécène du code',       'economie',      'or',     '1 000 000 FCFA abondés'),
  ('voix_griot_bronze',      'Voix du Griot',        'ia',            'bronze', '10 citations par le Griot'),
  ('voix_griot_argent',      'Voix du Griot',        'ia',            'argent', '100 citations par le Griot'),
  ('voix_griot_or',          'Voix du Griot',        'ia',            'or',     '1 000 citations par le Griot'),
  ('pont_nations_bronze',    'Pont entre nations',   'panafricain',   'bronze', 'Aidé des devs de 3 pays'),
  ('pont_nations_argent',    'Pont entre nations',   'panafricain',   'argent', 'Aidé des devs de 10 pays'),
  ('pont_nations_or',        'Pont entre nations',   'panafricain',   'or',     'Aidé des devs de 25 pays')
on conflict (code) do nothing;

insert into public.skills (name) values
  ('JavaScript'), ('TypeScript'), ('PHP'), ('Laravel'), ('Python'), ('Django'), ('Java'),
  ('Kotlin'), ('Dart'), ('Flutter'), ('React'), ('Next.js'), ('Vue'), ('Node.js'), ('Go'),
  ('PostgreSQL'), ('MySQL'), ('Docker'), ('Mobile Money'), ('USSD'), ('FedaPay'), ('Kkiapay'), ('CinetPay')
on conflict (name) do nothing;

-- ============================================================
-- Comptes de démo (mot de passe : baobab2026)
-- ============================================================

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000'::uuid, id::uuid, 'authenticated', 'authenticated', email,
       extensions.crypt('baobab2026', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}',
       jsonb_build_object('user_name', username, 'full_name', full_name),
       now() - interval '30 days', now(), '', '', '', ''
from (values
  ('a1000000-0000-4000-8000-000000000001', 'aicha',   'aicha@baobab.dev',   'Aïcha Dossou',      'Cotonou',     'Bénin',          'Dev back-end Laravel. J''intègre les paiements Mobile Money pour les PME de Cotonou.', 300, 'developer'),
  ('a1000000-0000-4000-8000-000000000002', 'koffi',   'koffi@baobab.dev',   'Koffi Kouassi',     'Abidjan',     'Côte d''Ivoire', 'Senior PHP/Laravel, 8 ans de paiements en ligne. Mentor et chasseur de primes.', 2100, 'developer'),
  ('a1000000-0000-4000-8000-000000000003', 'moussa',  'moussa@baobab.dev',  'Moussa Diop',       'Dakar',       'Sénégal',        'Fullstack Node/React. USSD, Wave et Orange Money.', 750, 'developer'),
  ('a1000000-0000-4000-8000-000000000004', 'fatou',   'fatou@baobab.dev',   'Fatou Agbodjan',    'Lomé',        'Togo',           'Dev mobile Flutter, passionnée de mobilité urbaine.', 180, 'developer'),
  ('a1000000-0000-4000-8000-000000000005', 'ibrahim', 'ibrahim@baobab.dev', 'Ibrahim Ouédraogo', 'Ouagadougou', 'Burkina Faso',   'Étudiant en informatique, Python et Django.', 40, 'developer'),
  ('a1000000-0000-4000-8000-000000000006', 'modo',    'modo@baobab.dev',    'Équipe Baobab',     'Cotonou',     'Bénin',          'Modération de la communauté.', 0, 'admin')
) as d(id, username, email, full_name, city, country, bio, xp_history, role);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users where email like '%@baobab.dev';

update public.profiles p
set city = d.city, country = d.country, bio = d.bio, role = d.role, created_at = now() - interval '30 days'
from (values
  ('a1000000-0000-4000-8000-000000000001', 'aicha',   'aicha@baobab.dev',   'Aïcha Dossou',      'Cotonou',     'Bénin',          'Dev back-end Laravel. J''intègre les paiements Mobile Money pour les PME de Cotonou.', 300, 'developer'),
  ('a1000000-0000-4000-8000-000000000002', 'koffi',   'koffi@baobab.dev',   'Koffi Kouassi',     'Abidjan',     'Côte d''Ivoire', 'Senior PHP/Laravel, 8 ans de paiements en ligne. Mentor et chasseur de primes.', 2100, 'developer'),
  ('a1000000-0000-4000-8000-000000000003', 'moussa',  'moussa@baobab.dev',  'Moussa Diop',       'Dakar',       'Sénégal',        'Fullstack Node/React. USSD, Wave et Orange Money.', 750, 'developer'),
  ('a1000000-0000-4000-8000-000000000004', 'fatou',   'fatou@baobab.dev',   'Fatou Agbodjan',    'Lomé',        'Togo',           'Dev mobile Flutter, passionnée de mobilité urbaine.', 180, 'developer'),
  ('a1000000-0000-4000-8000-000000000005', 'ibrahim', 'ibrahim@baobab.dev', 'Ibrahim Ouédraogo', 'Ouagadougou', 'Burkina Faso',   'Étudiant en informatique, Python et Django.', 40, 'developer'),
  ('a1000000-0000-4000-8000-000000000006', 'modo',    'modo@baobab.dev',    'Équipe Baobab',     'Cotonou',     'Bénin',          'Modération de la communauté.', 0, 'admin')
) as d(id, username, email, full_name, city, country, bio, xp_history, role) where p.id = d.id::uuid;
update public.profiles set languages = '{fr,en,fon}', goals = '{apprendre,collaborer,missions}' where username = 'aicha';
update public.profiles set languages = '{fr,en}', goals = '{aider,missions}' where username = 'koffi';
update public.profiles set languages = '{fr,wo,en}', goals = '{collaborer,missions}' where username = 'moussa';
update public.profiles set availability = 'limited' where username = 'fatou';

select public.add_points(d.id::uuid, d.xp_history, 'seed_history') from (values
  ('a1000000-0000-4000-8000-000000000001', 'aicha',   'aicha@baobab.dev',   'Aïcha Dossou',      'Cotonou',     'Bénin',          'Dev back-end Laravel. J''intègre les paiements Mobile Money pour les PME de Cotonou.', 300, 'developer'),
  ('a1000000-0000-4000-8000-000000000002', 'koffi',   'koffi@baobab.dev',   'Koffi Kouassi',     'Abidjan',     'Côte d''Ivoire', 'Senior PHP/Laravel, 8 ans de paiements en ligne. Mentor et chasseur de primes.', 2100, 'developer'),
  ('a1000000-0000-4000-8000-000000000003', 'moussa',  'moussa@baobab.dev',  'Moussa Diop',       'Dakar',       'Sénégal',        'Fullstack Node/React. USSD, Wave et Orange Money.', 750, 'developer'),
  ('a1000000-0000-4000-8000-000000000004', 'fatou',   'fatou@baobab.dev',   'Fatou Agbodjan',    'Lomé',        'Togo',           'Dev mobile Flutter, passionnée de mobilité urbaine.', 180, 'developer'),
  ('a1000000-0000-4000-8000-000000000005', 'ibrahim', 'ibrahim@baobab.dev', 'Ibrahim Ouédraogo', 'Ouagadougou', 'Burkina Faso',   'Étudiant en informatique, Python et Django.', 40, 'developer'),
  ('a1000000-0000-4000-8000-000000000006', 'modo',    'modo@baobab.dev',    'Équipe Baobab',     'Cotonou',     'Bénin',          'Modération de la communauté.', 0, 'admin')
) as d(id, username, email, full_name, city, country, bio, xp_history, role) where d.xp_history > 0;

insert into public.user_skills (user_id, skill_id, source, weight)
select d.id, s.id, 'github', w.weight
from (values
  ('aicha', 'PHP', 12), ('aicha', 'Laravel', 9), ('aicha', 'JavaScript', 6), ('aicha', 'MySQL', 5), ('aicha', 'FedaPay', 2),
  ('koffi', 'PHP', 25), ('koffi', 'Laravel', 20), ('koffi', 'FedaPay', 8), ('koffi', 'Kkiapay', 5), ('koffi', 'MySQL', 15), ('koffi', 'Docker', 6),
  ('moussa', 'JavaScript', 18), ('moussa', 'Node.js', 14), ('moussa', 'React', 12), ('moussa', 'USSD', 4), ('moussa', 'Mobile Money', 6), ('moussa', 'PostgreSQL', 7),
  ('fatou', 'Dart', 9), ('fatou', 'Flutter', 9), ('fatou', 'Node.js', 3),
  ('ibrahim', 'Python', 6), ('ibrahim', 'Django', 3)
) as w(username, skill, weight)
join public.profiles d on d.username = w.username
join public.skills s on s.name = w.skill;


-- ============================================================
-- Questions-réponses
-- ============================================================
insert into public.questions (id, author_id, title, body, tags, created_at) values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003',
   'Comment vérifier la signature d''un webhook FedaPay dans Laravel ?',
   E'Je reçois bien les webhooks FedaPay mais je ne sais pas comment vérifier qu''ils viennent vraiment de FedaPay.\n\n```php\nRoute::post(''/webhooks/fedapay'', [PaymentController::class, ''webhook'']);\n```\n\nQuelle est la bonne pratique ?',
   '{Laravel,FedaPay,PHP}', now() - interval '12 days'),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000005',
   'Paiement Mobile Money : statut « pending » qui ne passe jamais à « approved »',
   E'En sandbox Kkiapay, mes transactions MTN restent en pending. Le callback n''arrive jamais.\nJe suis sur Django, derrière ngrok.',
   '{Kkiapay,"Mobile Money",Python}', now() - interval '9 days'),
  ('b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000004',
   'Flutter : comment rendre mon appli utilisable hors connexion en 2G ?',
   E'Mon appli de covoiturage charge tout depuis l''API à chaque ouverture. En 2G c''est inutilisable.\nQuelle stratégie de cache conseillez-vous ?',
   '{Flutter,Dart}', now() - interval '6 days'),
  ('b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001',
   'Construire un menu USSD avec Node.js : quelle structure de sessions ?',
   E'Je dois faire un menu USSD à 3 niveaux (solde, transfert, historique). Comment gérer l''état entre les requêtes de l''opérateur ?',
   '{Node.js,USSD}', now() - interval '3 days');

insert into public.answers (id, question_id, author_id, body, created_at) values
  ('c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002',
   E'FedaPay signe chaque webhook dans l''en-tête `X-FEDAPAY-SIGNATURE`. Avec le SDK officiel :\n\n```php\nuse FedaPay\\Webhook;\n\npublic function webhook(Request $request)\n{\n    $event = Webhook::constructEvent(\n        $request->getContent(),\n        $request->header(''X-FEDAPAY-SIGNATURE''),\n        config(''services.fedapay.webhook_secret'')\n    );\n    // $event->name : transaction.approved, transaction.canceled...\n}\n```\n\nPense à exclure la route du middleware CSRF (`VerifyCsrfToken::$except`) et à rendre le traitement idempotent : le même événement peut arriver deux fois.',
   now() - interval '11 days'),
  ('c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   E'En complément : stocke l''id de transaction FedaPay avec une contrainte unique, et ne crédite la commande que sur `transaction.approved`. Ne te fie jamais au retour du navigateur (callback_url) pour valider un paiement.',
   now() - interval '10 days'),
  ('c1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003',
   E'En sandbox, MTN ne confirme pas tout seul : il faut utiliser les numéros de test fournis par Kkiapay. Vérifie aussi que l''URL de callback ngrok est bien déclarée dans le dashboard, sinon le statut reste pending. Tu peux interroger l''API de statut des transactions en secours.',
   now() - interval '8 days'),
  ('c1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002',
   E'Stratégie « offline first » : stocke les trajets dans une base locale (Drift ou Hive), affiche-les immédiatement, puis synchronise en arrière-plan avec un champ `updated_at` pour ne télécharger que les changements. Compresse les réponses (gzip) et pagine. En 2G, chaque Ko compte.',
   now() - interval '5 days'),
  ('c1000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000003',
   E'L''opérateur t''envoie un `sessionId` et le `text` cumulé (ex. `1*2*5000`). Le plus simple : découpe `text` sur `*` pour connaître le niveau, et stocke l''état intermédiaire dans Redis avec le sessionId comme clé et un TTL de 3 minutes. Réponds `CON ...` pour continuer et `END ...` pour terminer.',
   now() - interval '2 days');

-- Votes (déclenchent les XP)
insert into public.votes (user_id, answer_id, value) values
  ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 1),
  ('a1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 1),
  ('a1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 1),
  ('a1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002', 1),
  ('a1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 1),
  ('a1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000003', 1),
  ('a1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000003', 1),
  ('a1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000004', 1),
  ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000004', 1),
  ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000005', 1);

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}', false);
select public.accept_answer('c1000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated"}', false);
select public.accept_answer('c1000000-0000-4000-8000-000000000003');
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated"}', false);
select public.accept_answer('c1000000-0000-4000-8000-000000000004');

-- ============================================================
-- Showroom et Squads
-- ============================================================
insert into public.projects (owner_id, name, slug, description, demo_url, repo_url, stack, status, looking_for_contributors) values
  ('a1000000-0000-4000-8000-000000000001', 'Tontine Pay', 'tontine-pay',
   'Gestion de tontines avec cotisations en Mobile Money (MTN, Moov) et rappels par SMS.',
   null, 'https://github.com/aicha-dev/tontine-pay', '{Laravel,FedaPay,MySQL}', 'building', false),
  ('a1000000-0000-4000-8000-000000000003', 'Wari Map', 'wari-map',
   'Carte des points de retrait Mobile Money à Dakar, avec disponibilité signalée par la communauté.',
   'https://warimap.example', 'https://github.com/moussa/wari-map', '{React,Node.js,PostgreSQL}', 'launched', false),
  ('a1000000-0000-4000-8000-000000000004', 'Zem Partage', 'zem-partage',
   'Covoiturage et zémidjans partagés à Lomé, pensé pour fonctionner en 2G.',
   null, 'https://github.com/fatou/zem-partage', '{Flutter,Node.js}', 'building', true);

insert into public.squads (id, owner_id, project_id, name, description, roles_needed, skills_needed, duration_weeks, commitment, status) values
  ('d1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004',
   (select id from public.projects where slug = 'zem-partage'),
   'Squad Zem Partage', 'On cherche un dev back-end pour l''API de réservation et un dev Flutter pour le mode hors connexion.',
   '{"Back-end Node.js","Mobile Flutter"}', '{Node.js,Flutter,PostgreSQL}', 6, '5 h / semaine', 'recruiting'),
  ('d1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003',
   (select id from public.projects where slug = 'wari-map'),
   'Squad Wari Map', 'Lancement de Wari Map v1.', '{"Front React"}', '{React}', 4, '8 h / semaine', 'active');
update public.projects set squad_id = 'd1000000-0000-4000-8000-000000000001' where slug = 'zem-partage';
update public.projects set squad_id = 'd1000000-0000-4000-8000-000000000002' where slug = 'wari-map';

insert into public.squad_members (squad_id, user_id, role, status) values
  ('d1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Front React', 'member');
update public.squads set status = 'completed' where id = 'd1000000-0000-4000-8000-000000000002';

insert into public.tasks (squad_id, title, status, position) values
  ('d1000000-0000-4000-8000-000000000001', 'Modéliser les trajets et réservations', 'doing', 1),
  ('d1000000-0000-4000-8000-000000000001', 'Cache local des trajets (Hive)', 'todo', 2),
  ('d1000000-0000-4000-8000-000000000001', 'Paiement du trajet en Mobile Money', 'todo', 3);

-- ============================================================
-- Micro-Bourse (mode test)
-- ============================================================
select public.wallet_move(id, 100000, 'topup', null, null) from public.profiles where id::text like 'a1000000-%' and username <> 'modo';

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}', false);
select public.create_bounty(
  'SDK Wave : repli automatique en USSD quand l''API ne répond pas',
  'Quand l''API Wave dépasse 10 s, le SDK doit proposer le code USSD de paiement à l''utilisateur.',
  'https://github.com/moussa/wave-sdk-node',
  'Le test `fallback.test.js` passe : après un timeout simulé, `pay()` renvoie `{ mode: "ussd", code: "*880#" }`.',
  now() + interval '10 days', 15000, 'test/fallback.test.js');
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated"}', false);
select public.contribute_bounty((select id from public.bounties order by created_at desc limit 1), 5000);

select set_config('request.jwt.claims', '', false);

-- ============================================================
-- V1 : défi de la semaine et Stack Afrique
-- ============================================================
insert into public.challenges (title, description, kind, grading, sponsor_name, starts_at, ends_at, created_by) values
  ('Menu USSD de tontine en moins de 100 lignes',
   E'Construis un menu USSD à 3 niveaux (solde, cotiser, historique) pour une tontine.\n\n- Format opérateur : `sessionId`, `text` cumulé (`1*2*5000`), réponses `CON` / `END`\n- Node.js, Python ou PHP\n- Le jury note la lisibilité, la gestion des erreurs et la robustesse en cas de session expirée.',
   'api', 'jury', 'Kkiapay', now() - interval '2 days', now() + interval '5 days',
   'a1000000-0000-4000-8000-000000000006'),
  ('Écran de paiement Mobile Money en 2G',
   E'Une page de paiement (MTN, Moov, Wave) de moins de 50 Ko, utilisable dès 360 px et en 2G.',
   'interface', 'jury', null, now() - interval '12 days', now() - interval '5 days',
   'a1000000-0000-4000-8000-000000000006');

insert into public.challenge_submissions (challenge_id, user_id, solution_url, note)
select c.id, p.id, v.url, v.note
from (values
  ('moussa', 'https://github.com/moussa/ussd-tontine', 'Express + Redis, 84 lignes'),
  ('ibrahim', 'https://github.com/ibrahim/ussd-django', 'Django, avec tests')
) as v(username, url, note)
join public.profiles p on p.username = v.username
cross join (select id from public.challenges where kind = 'api') c;

insert into public.stack_items (name, slug, category, description, website, docs_url, compatible_versions, code_example, pitfalls, status, health_url, created_by) values
  ('FedaPay', 'fedapay', 'paiement',
   'Agrégateur de paiements Mobile Money (MTN, Moov) et cartes au Bénin, au Togo, en Côte d''Ivoire et au Sénégal.',
   'https://fedapay.com', 'https://docs.fedapay.com', 'SDK PHP 0.4+, Node 1.x, Laravel 9 à 11',
   E'```php\n\FedaPay\FedaPay::setApiKey(env(''FEDAPAY_SECRET_KEY''));\n\FedaPay\FedaPay::setEnvironment(''sandbox'');\n$tx = \FedaPay\Transaction::create([\n  ''amount'' => 5000, ''currency'' => [''iso'' => ''XOF''],\n  ''description'' => ''Cotisation'',\n]);\n```',
   E'- Vérifier la signature `X-FEDAPAY-SIGNATURE` des webhooks\n- Exclure la route webhook du CSRF\n- Rendre le traitement idempotent',
   'test', 'https://api.fedapay.com', 'a1000000-0000-4000-8000-000000000002'),
  ('Kkiapay', 'kkiapay', 'paiement',
   'Paiements Mobile Money et cartes, widget JavaScript prêt à l''emploi.',
   'https://kkiapay.me', 'https://docs.kkiapay.me', 'Widget JS v2, SDK Node, PHP, Python',
   null,
   E'- En sandbox, utiliser les numéros de test : sinon le statut reste pending\n- Toujours confirmer la transaction côté serveur',
   'test', 'https://api.kkiapay.me', 'a1000000-0000-4000-8000-000000000003'),
  ('Africa''s Talking', 'africas-talking', 'ussd',
   'API USSD, SMS et voix dans plus de 20 pays africains.',
   'https://africastalking.com', 'https://developers.africastalking.com', 'SDK Node 0.6+, Python 1.2+',
   E'```js\napp.post(''/ussd'', (req, res) => {\n  const { text } = req.body;\n  const steps = text ? text.split(''*'') : [];\n  res.send(steps.length === 0 ? ''CON 1. Solde\n2. Cotiser'' : ''END Merci'');\n});\n```',
   E'- Le `text` est cumulé : découper sur `*`\n- Répondre en moins de 10 s sinon la session est coupée',
   'test', null, 'a1000000-0000-4000-8000-000000000003');

insert into public.stack_attestations (item_id, user_id, in_production, comment)
select s.id, p.id, true, v.comment
from (values
  ('fedapay', 'koffi', 'En production sur 3 boutiques depuis 2024.'),
  ('fedapay', 'aicha', 'Tontine Pay, environ 400 transactions par mois.'),
  ('fedapay', 'moussa', null),
  ('fedapay', 'fatou', null),
  ('kkiapay', 'koffi', 'Fiable, support réactif.'),
  ('africas-talking', 'moussa', 'Menus USSD pour deux ONG à Dakar.')
) as v(slug, username, comment)
join public.stack_items s on s.slug = v.slug
join public.profiles p on p.username = v.username;

-- ============================================================
-- Discussions : sujets publics et une conversation privée
-- ============================================================
insert into public.conversations (id, kind, title, description, tags, created_by, created_at) values
  ('e1000000-0000-4000-8000-000000000001', 'topic', 'Paiements Mobile Money',
   'FedaPay, Kkiapay, CinetPay, Wave… retours d''expérience, pièges et bonnes pratiques.',
   '{FedaPay,Kkiapay,"Mobile Money"}', 'a1000000-0000-4000-8000-000000000002', now() - interval '20 days'),
  ('e1000000-0000-4000-8000-000000000002', 'topic', 'Freelance et missions en Afrique de l''Ouest',
   'Trouver des clients, fixer ses tarifs en FCFA, se faire payer à temps.',
   '{freelance,carrière}', 'a1000000-0000-4000-8000-000000000003', now() - interval '15 days'),
  ('e1000000-0000-4000-8000-000000000003', 'topic', 'Flutter et mobile en 2G',
   'Applis mobiles légères, mode hors ligne, APK de moins de 10 Mo.',
   '{Flutter,Dart}', 'a1000000-0000-4000-8000-000000000004', now() - interval '8 days');

insert into public.conversation_members (conversation_id, user_id, role)
select c.id, p.id, case when p.id = c.created_by then 'owner' else 'member' end
from (values
  ('e1000000-0000-4000-8000-000000000001', '{koffi,aicha,moussa,ibrahim}'),
  ('e1000000-0000-4000-8000-000000000002', '{moussa,koffi,fatou}'),
  ('e1000000-0000-4000-8000-000000000003', '{fatou,aicha}')
) as v(conv, users)
join public.conversations c on c.id = v.conv::uuid
join public.profiles p on p.username = any (v.users::text[]);

insert into public.messages (conversation_id, author_id, body, created_at)
select v.conv::uuid, p.id, v.body, now() - (v.ago || ' minutes')::interval
from (values
  ('e1000000-0000-4000-8000-000000000001', 'koffi', 'Bienvenue ! Ici on partage nos galères et nos astuces de paiement. Première règle : ne jamais valider une commande sur le callback navigateur.', '4000'),
  ('e1000000-0000-4000-8000-000000000001', 'moussa', 'Côté Sénégal, Wave a changé le format des webhooks la semaine dernière. Pensez à vérifier le champ `client_reference`.', '2600'),
  ('e1000000-0000-4000-8000-000000000001', 'aicha', 'Merci Moussa ! Quelqu''un a déjà utilisé CinetPay pour des paiements récurrents (tontine) ?', '900'),
  ('e1000000-0000-4000-8000-000000000001', 'koffi', '@aicha oui, mais il n''y a pas de vrai prélèvement automatique : on envoie un lien de paiement chaque mois par SMS.', '840'),
  ('e1000000-0000-4000-8000-000000000002', 'moussa', 'Combien vous facturez une appli e-commerce simple à Dakar ? Je suis autour de 800 000 FCFA.', '3000'),
  ('e1000000-0000-4000-8000-000000000002', 'koffi', 'À Abidjan c''est similaire. Demande toujours 40 % d''acompte, en Mobile Money c''est instantané.', '2900'),
  ('e1000000-0000-4000-8000-000000000002', 'fatou', 'Et pour les ONG, passez par la Micro-Bourse : paiement garanti au code qui fonctionne.', '1500'),
  ('e1000000-0000-4000-8000-000000000003', 'fatou', 'Astuce : `flutter build apk --split-per-abi` divise la taille de l''APK par 3.', '600')
) as v(conv, username, body, ago)
join public.profiles p on p.username = v.username
order by (v.ago)::int desc;

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
select public.get_or_create_direct('a1000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claims', '', false);

insert into public.messages (conversation_id, author_id, body, created_at)
select c.id, p.id, v.body, now() - (v.ago || ' minutes')::interval
from (values
  ('aicha', 'Salut Koffi ! Merci pour ta réponse sur les webhooks FedaPay, ça m''a débloquée.', '300'),
  ('koffi', 'Avec plaisir ! Si tu veux, on peut faire une session de Pair-Debugging sur Tontine Pay cette semaine.', '280')
) as v(username, body, ago)
join public.profiles p on p.username = v.username
cross join (select id from public.conversations where kind = 'direct' limit 1) c
order by (v.ago)::int desc;

-- Le message de Koffi reste non lu pour Aïcha (démo des non-lus)
update public.conversation_members set last_read_at = now() - interval '290 minutes'
where user_id = 'a1000000-0000-4000-8000-000000000001'
  and conversation_id = (select id from public.conversations where kind = 'direct' limit 1);
