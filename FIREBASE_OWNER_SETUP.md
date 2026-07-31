# Firebase owner setup for Flowboard

Flowboard uses GitHub Pages for hosting and Firebase Spark for Google Authentication and Cloud Firestore. Aaron should own the Firebase/Google project. Do not send database passwords, service-account JSON, private keys, OAuth client secrets, or Admin SDK credentials.

## 1. Create the no-cost project

1. Open https://console.firebase.google.com/ and choose **Create a project**.
2. Suggested project name: `Flowboard` (the generated project ID may differ).
3. Google Analytics is optional and not required by Flowboard.
4. Remain on the **Spark** plan. Do not attach a billing account for this rollout.

## 2. Register the GitHub Pages web app

1. In **Project settings → General → Your apps**, add a **Web** app.
2. Suggested nickname: `Flowboard Web`.
3. Do not enable Firebase Hosting; GitHub Pages remains the host.
4. Copy the displayed `firebaseConfig` object. Its web values are public client identifiers.
5. Send Hera the following values only:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

## 3. Enable Google sign-in

1. Open **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Google**.
3. Choose the project support email and save.
4. In **Authentication → Settings → Authorized domains**, ensure these are present:
   - `kcchanai.github.io`
   - `localhost`

Firebase manages the Google OAuth redirect for this provider. Do not create or send a Google client secret for the normal Firebase web flow.

## 4. Create Cloud Firestore

1. Open **Build → Firestore Database → Create database**.
2. Choose **Standard edition**.
3. Choose **Production mode**, not test mode.
4. Select the region closest to the intended users. The database location cannot be casually changed later.
5. Do not paste permissive temporary rules. Hera will deploy the reviewed `firestore.rules` file after emulator tests pass.

## 5. Give Hera a deployment path

Choose one:

- **Preferred:** invite the Google account Aaron designates for this work to the Firebase project with the minimum role needed to deploy Firestore rules/indexes; or
- Aaron runs the exact reviewed Firebase CLI deployment command Hera provides after tests pass.

Do not create an Admin SDK service-account key for this client application.

## 6. Prepare test users

Full acceptance testing eventually needs three separate Google accounts:

- Organizer/owner
- Editor
- Viewer

Use disposable test accounts without sensitive workspaces. Do not send passwords; each person signs in directly through Google.

## 7. Invitation and privacy decisions

The free first release uses copyable, email-matched invitation links; no email provider or Cloud Function is required. Before real users are invited, decide:

- Invite expiration period (recommended: 7 days)
- Workspace/account deletion expectations
- Data retention expectations
- Whether activity history should be retained after a member leaves

## Values that must never be supplied or committed

- Service-account JSON/private key
- Firebase Admin SDK credentials
- Google OAuth client secret
- Database credentials
- Email-provider credentials
- Real `.env` files

Flowboard's public Firebase web configuration is safe to place in the browser build only because Firestore Security Rules—not the API key—enforce authorization.
