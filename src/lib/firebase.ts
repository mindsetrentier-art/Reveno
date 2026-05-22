import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    console.log('Starting Google Sign-In for domain:', window.location.hostname);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error details:', {
      message: error.message,
      code: error.code,
      domain: window.location.hostname
    });
    
    if (error.code === 'auth/popup-blocked') {
      alert('Le pop-up a été bloqué par votre navigateur. Veuillez autoriser les fenêtres surgissantes pour ce site.');
    } else if (error.code === 'auth/popup-closed-by-user') {
      // User closed the popup, no need to alert, just log it
      console.log('User closed the login popup.');
      return null;
    } else if (error.code === 'auth/unauthorized-domain') {
      const url = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;
      alert(`Erreur de domaine ! Le domaine n'était pas autorisé. Ce problème vient normalement d'être résolu par le système.\n\nVeuillez réessayer. Si le problème persiste, cliquez sur le bouton "Open in a new window" en haut à droite pour ouvrir l'application dans un nouvel onglet, ou vérifiez vos domaines autorisés dans la console Firebase.`);
    } else {
      alert(`Erreur lors de la connexion (${error.code}).\n\nSi vous voyez ce message dans la prévisualisation, essayez d'ouvrir l'application dans un nouvel onglet (bouton "Open in a new window" en haut à droite). Certains navigateurs bloquent la connexion dans la vue incrustée.`);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};
