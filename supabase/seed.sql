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
update public.profiles set programming_languages = '{JavaScript,TypeScript,PHP}' where username = 'aicha';
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

-- ============================================================
-- V2 : clone IA de Koffi (niveau Expert)
-- ============================================================
insert into public.ai_clones (id, owner_id, name, specialty, description, style_notes, status, published_at) values
  ('f1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002',
   'Koffi IA', 'PHP, Laravel et paiements en ligne (FedaPay, Kkiapay, Mobile Money)',
   'Huit ans d''intégrations de paiement en Côte d''Ivoire. Je réponds comme Koffi : direct, avec du code.',
   'direct et bienveillant, va droit au code, insiste sur la sécurité et l''idempotence, tutoie',
   'published', now() - interval '6 days');

insert into public.clone_sources (clone_id, kind, answer_id, title, content)
select 'f1000000-0000-4000-8000-000000000001', 'answer', a.id, q.title, a.body
from public.answers a join public.questions q on q.id = a.question_id
where a.author_id = 'a1000000-0000-4000-8000-000000000002';

insert into public.clone_sources (clone_id, kind, title, content) values
  ('f1000000-0000-4000-8000-000000000001', 'note', 'Files d''attente Laravel pour les paiements',
   E'Ne traite jamais un webhook de paiement dans la requête HTTP : réponds 200 tout de suite et pousse un job.\n\n```php\npublic function webhook(Request $request) {\n    ProcessPayment::dispatch($request->all());\n    return response()->noContent();\n}\n```\n\nAvec `php artisan queue:work --tries=3`, un échec temporaire de ta base ne fait pas perdre le paiement. Sur un petit VPS, Redis ou même le driver `database` suffisent.'),
  ('f1000000-0000-4000-8000-000000000001', 'note', 'Rendre un paiement Mobile Money idempotent',
   E'Le même événement peut arriver plusieurs fois (réseau instable, relances de l''agrégateur). Règle d''or : une contrainte unique sur l''identifiant de transaction de l''agrégateur, et une mise à jour conditionnelle.\n\n```php\nOrder::where(''id'', $orderId)->where(''status'', ''pending'')->update([''status'' => ''paid'']);\n```\n\nSi la ligne est déjà payée, la requête ne fait rien : pas de double livraison.');

select public.record_clone_query('a1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000001',
  'Comment éviter de livrer deux fois une commande payée par Mobile Money ?',
  E'Rends le traitement idempotent : contrainte unique sur l''identifiant de transaction et mise à jour conditionnelle `where status = pending` [1].',
  'answered', array(select id from public.clone_sources where title like 'Rendre un paiement%'));
select public.record_clone_query('a1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000001',
  'Faut-il traiter le webhook FedaPay dans le contrôleur ?',
  E'Non : réponds 200 tout de suite et pousse un job dans une file d''attente [1].',
  'answered', array(select id from public.clone_sources where title like 'Files d''attente%'));
select public.record_clone_query('a1000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000001',
  'Comment vérifier la signature d''un webhook FedaPay ?',
  E'Utilise `Webhook::constructEvent` avec l''en-tête `X-FEDAPAY-SIGNATURE` et ton secret [1].',
  'answered', array(select id from public.clone_sources where kind = 'answer' limit 1));
update public.clone_queries set rating = 5 where user_id = 'a1000000-0000-4000-8000-000000000003';
update public.clone_queries set rating = 4 where user_id = 'a1000000-0000-4000-8000-000000000005';

-- ============================================================
-- V2 : Code Forensic (Aïcha fait auditer Tontine Pay, Koffi audite)
-- ============================================================
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
select public.create_audit('Tontine Pay avant la levée de fonds', 'https://github.com/aicha-dev/tontine-pay',
  'Levée de fonds d''amorçage en janvier : les investisseurs demandent un audit du code de paiement.', 'private', 3, 15000, 14);
update public.audits set auto_report = '{"analyzed_at":"2026-11-04T10:00:00Z","accessible":true,"language":"PHP","files":214,"source_files":121,"test_files":4,"dependencies_checked":18,"dependencies_outdated":3}'
where title like 'Tontine Pay%';
insert into public.audit_findings (audit_id, source, category, severity, title, description, fix, file_path, effort_hours)
select a.id, 'auto', v.category, v.severity, v.title, v.description, v.fix, v.file_path, v.effort
from public.audits a, (values
  ('securite', 'critique', 'Secret probablement commis : fichier .env', 'Le fichier `.env` est versionné. S''il contient des clés, elles restent dans l''historique git.', 'Révoquer les clés FedaPay, purger l''historique (git filter-repo) et ajouter .env au .gitignore.', '.env', 2.0),
  ('dependances', 'moyen', '3 dépendance(s) Composer avec une version majeure de retard', E'- `laravel/framework` : ^9.0 → 11.x\n- `fedapay/fedapay-php` : ^0.3 → 1.x\n- `phpunit/phpunit` : ^9.5 → 11.x', 'Mettre à jour une dépendance à la fois et faire tourner les tests à chaque étape.', 'composer.json', 6.0),
  ('tests', 'mineur', 'Couverture de tests faible', '4 fichier(s) de test pour 121 fichiers de code (3 %).', 'Tester d''abord le parcours de cotisation et le webhook de paiement.', null, 15.0)
) as v(category, severity, title, description, fix, file_path, effort)
where a.title like 'Tontine Pay%';

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
select public.join_audit((select id from public.audits where title like 'Tontine Pay%'), true, 'Koffi Kouassi');
select public.add_audit_finding((select id from public.audits where title like 'Tontine Pay%'), 'securite', 'critique',
  'Webhook FedaPay accepté sans vérification de signature',
  E'Dans `PaymentController@webhook`, l''événement est traité sans appeler `Webhook::constructEvent` : n''importe qui peut marquer une cotisation comme payée avec un simple POST.',
  'Vérifier l''en-tête X-FEDAPAY-SIGNATURE avec le secret du webhook, et rejeter en 400 sinon.', 'app/Http/Controllers/PaymentController.php', 2);
select public.add_audit_finding((select id from public.audits where title like 'Tontine Pay%'), 'architecture', 'moyen',
  'Traitement du paiement dans la requête HTTP',
  'Le webhook met à jour la base et envoie les SMS dans la même requête : au moindre ralentissement, FedaPay relance et le paiement est traité deux fois.',
  'Répondre 200 immédiatement et pousser un job dans une file d''attente, avec une mise à jour idempotente.', 'app/Http/Controllers/PaymentController.php', 4);
select public.add_audit_finding((select id from public.audits where title like 'Tontine Pay%'), 'performance', 'mineur',
  'Requête N+1 sur la liste des membres',
  'La page des tontines charge les cotisations de chaque membre une par une (une requête par membre).',
  'Utiliser `with(''cotisations'')` dans la requête Eloquent.', 'app/Http/Controllers/TontineController.php', 1);

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
select public.contest_finding((select id from public.audit_findings where title like 'Requête N+1%'),
  'Corrigé la semaine dernière, la version auditée date d''avant le correctif.');
select set_config('request.jwt.claims', '', false);

-- ============================================================
-- V2 : projets en sommeil (détecteur de projets abandonnés)
-- ============================================================
insert into public.projects (owner_id, name, slug, description, repo_url, stack, status,
                             last_commit_at, repo_stars, repo_forks, unanswered_issues, repo_checked_at, abandon_status, abandon_detected_at)
values
  ('a1000000-0000-4000-8000-000000000003', 'Météo Agri Sénégal', 'meteo-agri-senegal',
   'Alertes météo par SMS pour les agriculteurs du bassin arachidier, en wolof et en français.',
   'https://github.com/moussa/meteo-agri', '{Node.js,"Africa''s Talking",PostgreSQL}', 'abandoned',
   now() - interval '8 months', 34, 6, 4, now() - interval '1 day', 'detected', now() - interval '1 day');

insert into public.projects (owner_id, name, slug, description, repo_url, stack, status,
                             last_commit_at, repo_stars, repo_forks, unanswered_issues, repo_checked_at, abandon_status, founder_id)
values
  ('a1000000-0000-4000-8000-000000000005', 'Annuaire des artisans de Ouaga', 'artisans-ouaga',
   'Trouver un menuisier, un soudeur ou un tailleur près de chez soi, avec avis et contact WhatsApp.',
   'https://github.com/ibrahim/artisans-ouaga', '{Django,PostgreSQL}', 'abandoned',
   now() - interval '11 months', 12, 3, 2, now() - interval '2 days', 'ceded', 'a1000000-0000-4000-8000-000000000005');

-- ============================================================
-- V2 : Radar d'opportunités (compte organisation : mairie@baobab.dev)
-- ============================================================
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated',
        'mairie@baobab.dev', extensions.crypt('baobab2026', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{"user_name":"mairie_cotonou","full_name":"Mairie de Cotonou"}',
        now() - interval '10 days', now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), 'a1000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000007',
        '{"sub":"a1000000-0000-4000-8000-000000000007","email":"mairie@baobab.dev","email_verified":true}', 'email', now(), now(), now());
update public.profiles set role = 'organization', city = 'Cotonou', country = 'Bénin',
  bio = 'Direction de la transformation numérique de la ville de Cotonou.'
where id = 'a1000000-0000-4000-8000-000000000007';

insert into public.opportunities (id, source, publisher_id, organization_name, org_type, title, raw_text, need, technologies,
                                  budget_min, budget_max, deadline, country, city, contact, source_url, extracted_by, status, created_at) values
  ('a2000000-0000-4000-8000-000000000001', 'publiee', 'a1000000-0000-4000-8000-000000000007', 'Mairie de Cotonou', 'collectivite',
   'Paiement des taxes de marché par Mobile Money et USSD',
   E'La Mairie de Cotonou souhaite permettre aux commerçants des marchés Dantokpa et Ganhi de payer leurs taxes journalières par Mobile Money (MTN, Moov) et par USSD, sans smartphone.\nLes agents collecteurs doivent pouvoir vérifier un paiement en scannant un reçu.\nBudget : 8 000 000 à 12 000 000 FCFA. Réponses attendues avant le 15/12/2026.',
   'Permettre aux commerçants des marchés de payer leurs taxes par Mobile Money et USSD, avec vérification des reçus par les agents.',
   '{Laravel,"Mobile Money",USSD,FedaPay}', 8000000, 12000000, (now() + interval '40 days')::date, 'Bénin', 'Cotonou',
   'numerique@mairie-cotonou.bj', null, 'manuel', 'open', now() - interval '2 days'),
  ('a2000000-0000-4000-8000-000000000002', 'collectee', null, 'ONG Santé Communautaire Togo', 'ong',
   'Application mobile hors ligne de collecte de données de santé',
   E'Recrutement d''un prestataire pour une application Android de collecte de données de santé communautaire, utilisable sans connexion dans les villages de la région des Plateaux, avec synchronisation à Lomé.\nBudget indicatif : 6 millions FCFA.',
   'Une application Android hors ligne pour les agents de santé communautaires, synchronisée avec un serveur à Lomé.',
   '{Flutter,Dart,PostgreSQL}', 6000000, 6000000, (now() + interval '25 days')::date, 'Togo', 'Lomé',
   null, 'https://exemple.org/appels-offres/sante-plateaux', 'regles', 'open', now() - interval '5 days'),
  ('a2000000-0000-4000-8000-000000000003', 'collectee', null, 'Boutique Akwaba', 'pme',
   'Boutique en ligne avec paiement Wave et Orange Money',
   E'PME de prêt-à-porter à Abidjan, nous cherchons un développeur ou une petite équipe pour une boutique en ligne avec paiement Wave et Orange Money et livraison à domicile.\nBudget entre 2 500 000 et 4 000 000 FCFA.',
   'Une boutique en ligne de prêt-à-porter avec paiement Wave et Orange Money et suivi des livraisons.',
   '{React,Node.js,"Mobile Money"}', 2500000, 4000000, (now() + interval '20 days')::date, 'Côte d''Ivoire', 'Abidjan',
   null, 'https://exemple.org/annonces/boutique-akwaba', 'regles', 'open', now() - interval '1 day');

-- Retours du 11/11 : un appel d'offres à échéance imminente (validé) et un autre en attente de validation
insert into public.opportunities (id, source, publisher_id, organization_name, org_type, title, raw_text, need, technologies,
                                  budget_min, budget_max, deadline, country, city, source_url, extracted_by, status, created_at,
                                  reviewed_by, reviewed_at) values
  ('a2000000-0000-4000-8000-000000000004', 'collectee', null, 'Agence de Développement de Dakar', 'collectivite',
   'Portail de suivi des permis de construire',
   E'L''Agence recherche un prestataire pour un portail web de dépôt et de suivi des permis de construire, avec notifications SMS.
Budget : 15 000 000 FCFA. Date limite de dépôt des offres : dans 3 jours.',
   'Un portail web de dépôt et de suivi des permis de construire, avec notifications SMS aux demandeurs.',
   '{Laravel,PostgreSQL,SMS}', 15000000, 15000000, (now() + interval '3 days')::date, 'Sénégal', 'Dakar',
   'https://exemple.org/appels-offres/permis-dakar', 'regles', 'open', now() - interval '6 hours',
   'a1000000-0000-4000-8000-000000000006', now() - interval '5 hours'),
  ('a2000000-0000-4000-8000-000000000005', 'collectee', null, 'Coopérative cacaoyère de Soubré', 'pme',
   'Traçabilité du cacao par application mobile',
   E'Coopérative de 1 200 producteurs, nous cherchons une application mobile hors ligne pour enregistrer les pesées et payer les producteurs par Mobile Money.
Budget indicatif : 7 millions FCFA. Offres avant 5 jours.',
   'Une application mobile hors ligne pour enregistrer les pesées de cacao et payer les producteurs par Mobile Money.',
   '{Flutter,"Mobile Money"}', 7000000, 7000000, (now() + interval '5 days')::date, 'Côte d''Ivoire', 'Soubré',
   'https://exemple.org/appels-offres/cacao-soubre', 'regles', 'pending', now() - interval '2 hours', null, null);

select public.compute_opportunity_matches(id) from public.opportunities where status = 'open';
select public.notify_opportunity_matches(id) from public.opportunities where status = 'open';

-- ============================================================
-- V2 : Centrale d'achat d'infrastructures
-- ============================================================
insert into public.infra_offers (code, category, name, provider, description, unit, billing_mode, wholesale_price, price, public_price) values
  ('vps-s', 'calcul', 'Serveur cloud S', 'Partenaire cloud (Afrique de l''Ouest)', '1 vCPU, 1 Go de RAM, 25 Go SSD, IP publique. Idéal pour une API Laravel ou Node.', 'heure', 'horaire', 9.00, 10.00, 14.00),
  ('vps-m', 'calcul', 'Serveur cloud M', 'Partenaire cloud (Afrique de l''Ouest)', '2 vCPU, 4 Go de RAM, 80 Go SSD. Pour une application en production.', 'heure', 'horaire', 18.00, 20.00, 28.00),
  ('pg-s', 'base_de_donnees', 'PostgreSQL managé S', 'Partenaire cloud (Europe)', '10 Go, sauvegarde automatique quotidienne, connexion chiffrée.', 'heure', 'horaire', 7.00, 8.00, 12.00),
  ('build', 'build', 'Instance de build', 'Partenaire cloud (Europe)', '4 vCPU pour compiler une application Flutter ou exécuter des tests. Facturée à l''heure.', 'heure', 'horaire', 13.50, 15.00, 22.00),
  ('monitoring', 'monitoring', 'Monitoring et alertes', 'Partenaire monitoring', 'Disponibilité, temps de réponse et alertes par SMS ou WhatsApp.', 'heure', 'horaire', 0.60, 0.68, 1.10),
  ('sms', 'sms', 'Passerelle SMS', 'Passerelle SMS régionale', 'Envoi de SMS vers les opérateurs d''Afrique de l''Ouest par API. Limite anti-spam : 100 SMS par heure.', 'sms', 'a_l_usage', 18.00, 20.00, 30.00),
  ('ia', 'ia', 'Clé d''API d''IA (Claude)', 'Anthropic, via la Centrale', 'Une clé personnelle compatible avec l''API Messages, facturée au millier de jetons.', '1k_jetons', 'a_l_usage', 5.40, 6.00, 7.50),
  ('domaine', 'domaine', 'Nom de domaine .com ou .africa', 'Registraire partenaire', 'Un an de nom de domaine, DNS géré.', 'an', 'unique', 8000.00, 9000.00, 12000.00);

-- Koffi est membre : un serveur et une base pour Tontine Pay, avec un mois de consommation
insert into public.infra_members (user_id) values ('a1000000-0000-4000-8000-000000000002'), ('a1000000-0000-4000-8000-000000000001');
insert into public.infra_credits (user_id, balance) values ('a1000000-0000-4000-8000-000000000002', 0), ('a1000000-0000-4000-8000-000000000001', 2000);
insert into public.infra_credit_grants (user_id, amount, reason) values ('a1000000-0000-4000-8000-000000000001', 2000, 'Bienvenue dans la coopérative');
insert into public.infra_budgets (user_id, monthly_cap) values ('a1000000-0000-4000-8000-000000000002', 15000);
insert into public.infra_resources (id, owner_id, offer_id, project_id, name, last_billed_at, last_backup_at, created_at)
select 'a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', o.id,
       (select id from public.projects where slug = 'wari-map'), 'api-wari-map', now() - interval '20 minutes', null, now() - interval '12 days'
from public.infra_offers o where o.code = 'vps-s';
insert into public.infra_resources (id, owner_id, offer_id, project_id, name, last_billed_at, last_backup_at, created_at)
select 'a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', o.id,
       (select id from public.projects where slug = 'wari-map'), 'base-wari-map', now() - interval '20 minutes', now() - interval '3 hours', now() - interval '12 days'
from public.infra_offers o where o.code = 'pg-s';
select public.record_usage('a3000000-0000-4000-8000-000000000001', 24) from generate_series(1, 12);
select public.record_usage('a3000000-0000-4000-8000-000000000002', 24) from generate_series(1, 12);
update public.usage_records set created_at = now() - ((id % 12) || ' days')::interval where owner_id = 'a1000000-0000-4000-8000-000000000002';
update public.infra_resources set last_billed_at = now() - interval '20 minutes' where owner_id = 'a1000000-0000-4000-8000-000000000002';

insert into public.infra_proposals (title, description, proposed_by, created_at) values
  ('Négocier un stockage objet type S3', 'Pour les images des boutiques en ligne et les sauvegardes.', 'a1000000-0000-4000-8000-000000000002', now() - interval '6 days'),
  ('Ajouter une passerelle WhatsApp Business', 'Beaucoup de nos clients préfèrent WhatsApp aux SMS.', 'a1000000-0000-4000-8000-000000000001', now() - interval '3 days');
insert into public.infra_proposal_votes (proposal_id, user_id)
select p.id, u from public.infra_proposals p,
  unnest(array['a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002']::uuid[]) u
where p.title like 'Négocier%';

-- ============================================================
-- Espace recruteurs : préférences des devs, un recruteur abonné, une proposition en attente
-- ============================================================
-- Comptes GitHub de démo (inexistants : l'activité affichée reste vide)
update public.profiles set github_username = 'baobab-demo-' || username
where username in ('koffi', 'aicha', 'moussa');
update public.profiles set open_to = d.open_to from (values
  ('koffi', '{freelance,mission,remote}'::text[]),
  ('aicha', '{cdi,freelance}'::text[]),
  ('moussa', '{cdi,remote}'::text[]),
  ('fatou', '{stage,cdd}'::text[]),
  ('ibrahim', '{stage}'::text[])
) as d(username, open_to) where profiles.username = d.username;
-- Ibrahim préfère rester invisible des recruteurs
update public.profiles set recruiter_visible = false where username = 'ibrahim';

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000007","role":"authenticated"}', false);
select public.wallet_move('a1000000-0000-4000-8000-000000000007', 100000, 'topup', null, null);
select public.subscribe_recruiter('Mairie de Cotonou');
select public.toggle_shortlist('a1000000-0000-4000-8000-000000000001', 'Profil Laravel + Mobile Money, idéal pour la régie des marchés.');
select public.recruiter_view_profile('a1000000-0000-4000-8000-000000000001');
select public.recruiter_view_profile('a1000000-0000-4000-8000-000000000002');
select public.send_recruiter_contact('a1000000-0000-4000-8000-000000000002', 'mission',
  'Audit de la plateforme de paiement des taxes',
  'Bonjour Koffi, la Mairie de Cotonou modernise l''encaissement des taxes de marché par Mobile Money. Nous cherchons un senior pour auditer l''intégration existante et accompagner l''équipe pendant 6 semaines.',
  '1 500 000 FCFA');
select set_config('request.jwt.claims', '', false);
