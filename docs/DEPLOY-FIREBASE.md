# Déployer Nejma Med sur Firebase (App Hosting)

Nejma Med est une application **Next.js avec serveur** (Server Actions, cookies, sessions).
Elle se déploie donc avec **Firebase App Hosting**, et **pas** avec l'ancien « Firebase Hosting »
qui ne sert que des fichiers statiques.

> Firebase sert ici uniquement à **héberger** le site. Les données (comptes, questions, résultats)
> viennent de **Supabase**, ou du **mode démo** tant que Supabase n'est pas configuré.

Cette procédure a été vérifiée avec l'adaptateur officiel `@apphosting/adapter-nextjs` : le build
de production passe et toutes les pages fonctionnent dans le serveur « standalone » utilisé par
App Hosting.

---

## 1. Prérequis

- **Node.js 20.9 ou plus** (22 recommandé) : https://nodejs.org
- Un compte Google
- Un projet Firebase sur le **forfait Blaze** (paiement à l'usage). App Hosting l'exige.
  Une carte bancaire est demandée, mais il existe un quota gratuit mensuel : un petit site
  étudiant reste en général à 0 €. **Créez une alerte de budget** (Google Cloud → Facturation →
  Budgets et alertes), par exemple à 1 €.

## 2. Tester le projet sur votre PC (facultatif, recommandé)

```bash
# décompressez nejma-med.zip, puis :
cd nejma-med
npm install
npm run dev
```

Ouvrez http://localhost:3000. Le bandeau jaune « Mode démo » est normal.

## 3. Installer l'outil Firebase

```bash
npm install -g firebase-tools
firebase --version      # version 15 ou plus
firebase login
```

## 4. Créer le projet et le backend

1. Sur https://console.firebase.google.com, créez un projet (par ex. `nejma-med`) et passez-le au
   forfait **Blaze**.
2. Dans le dossier du projet :

   ```bash
   firebase init apphosting
   ```

   Répondez :
   - *Project* → **Use an existing project** → votre projet
   - *Backend* → **créer un nouveau backend**, nom : `nejma-med`
   - *Region* → une région **européenne** de la liste proposée (la plus proche de l'Algérie),
     par ex. `europe-west4` si elle apparaît
   - *Root directory* → `/` (la racine du projet)

   La commande crée `firebase.json` et `.firebaserc`.

## 5. Déployer

```bash
firebase deploy --only apphosting
```

Le code est envoyé puis construit dans le cloud (5 à 10 minutes la première fois). À la fin,
Firebase affiche l'adresse du site, du type :

```
https://nejma-med--<id-du-projet>.<région>.hosted.app
```

Pour chaque mise à jour, relancez simplement `firebase deploy --only apphosting`.

Le suivi du build et les journaux d'erreurs se trouvent dans la console Firebase →
**App Hosting** → votre backend → **Rollouts** / **Logs**.

## 6. Ce que fait le mode démo (sans Supabase)

- Tout fonctionne : choix de la filière, QCM, examen blanc, anatomie 3D, FR/EN.
- Les données sont gardées **en mémoire du serveur** : elles disparaissent quand le serveur
  s'endort (quelques minutes sans visite) ou lors d'un nouveau déploiement.
- `apphosting.yaml` limite le site à **1 instance** (`maxInstances: 1`) pour que ces données
  restent cohérentes.

C'est parfait pour montrer le projet. Pour de vrais étudiants, connectez Supabase (étape 7).

## 7. Connecter Supabase (comptes et résultats permanents)

1. Suivez `docs/SETUP.md`, étape **2a** (création du projet Supabase, schéma, données de départ).
2. Dans Supabase → **Authentication → URL configuration** :
   - *Site URL* : l'adresse `https://…hosted.app` de l'étape 5
   - *Redirect URLs* : ajoutez `https://…hosted.app/auth/confirm`
3. Dans `apphosting.yaml`, décommentez les trois variables `NEXT_PUBLIC_…`, remplissez-les avec
   vos valeurs (Supabase → Project Settings → API Keys), et augmentez `maxInstances` (par ex. 10).
4. Redéployez : `firebase deploy --only apphosting`.

Le bandeau « Mode démo » disparaît : les étudiants peuvent créer un compte.

## Dépannage

| Problème | Solution |
| --- | --- |
| « Project must be on the Blaze plan » | Passez le projet au forfait Blaze dans la console Firebase. |
| Le build échoue | Lisez les journaux du rollout. Vérifiez que `package-lock.json` est bien présent. |
| Toujours « Mode démo » après avoir ajouté Supabase | Les variables `NEXT_PUBLIC_…` doivent avoir `availability: [BUILD, RUNTIME]` ; redéployez. |
| Connexion : retour à la page login en boucle | *Site URL* et *Redirect URLs* mal réglés dans Supabase (étape 7.2). |
| Examen « introuvable » en mode démo | Le serveur s'est endormi ou a redémarré : c'est la limite du mode démo. Connectez Supabase. |

> Utiliser **Firestore** à la place de Supabase comme base de données est possible, mais
> demanderait de réécrire la couche de données (`src/server/data`) et les règles de sécurité.
> Supabase est conseillé pour ce projet (voir `docs/ARCHITECTURE.md`, section 1).
