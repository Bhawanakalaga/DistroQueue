# running DISTROQUEUE Locally in VS Code

Follow these steps to set up and run the project on your local machine.

## Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**
- A **Firebase Project** (already set up if you are using this app)

## 1. Export the Code
1. In Google AI Studio, go to the **Settings** (gear icon) or the **Export** menu.
2. Select **Export to ZIP** or **Push to GitHub**.
3. Download and extract the ZIP file to a folder on your computer.

## 2. Install Dependencies
Open your terminal in the project folder and run:
```bash
npm install
```

## 3. Configure Environment Variables
You need to set up your `.env` file with the necessary secrets.
1. Create a file named `.env` in the root directory.
2. Copied the template from `.env.example`.
3. Fill in the values:
   - `GEMINI_API_KEY`: Get this from Google AI Studio.
   - `JWT_SECRET`: Any random string (e.g., `distro-secret-123`).
   - `ADMIN_USERNAME`: Your choice (e.g., `admin`).
   - `ADMIN_PASSWORD`: Your choice (e.g., `password`).

## 4. Firebase Configuration
The project uses `firebase-applet-config.json` for connectivity. This should already be present if you exported from a set-up project. If not:
1. Go to your Firebase Console.
2. Projects Settings > General.
3. Under "Your apps", find the Web App config and copy the `firebaseConfig` object into a file named `firebase-applet-config.json` in the root.

## 5. Run the Application
The project is a full-stack Express + Vite application. You can run it in development mode:

```bash
npm run dev
```

- **Dashbaord**: Open `http://localhost:3000` in your browser.
- **Backend/Worker**: The server will start the background worker loop automatically.

## 6. Deployment (Optional)
To build for production:
```bash
npm run build
npm start
```

## Troubleshooting
- **Permission Denied**: If you see Firestore permission errors, ensure you have deployed the `firestore.rules` file to your project using the Firebase CLI (`firebase deploy --only firestore:rules`).
- **Missing API Key**: Ensure `GEMINI_API_KEY` is set if you want AI failure analysis to work.
