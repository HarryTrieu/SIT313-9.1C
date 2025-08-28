
import React, { createContext, useContext, useState, useEffect } from 'react';
import logger from '../utils/logger';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { updateDoc } from 'firebase/firestore';
import { verifyTOTP } from '../utils/totp';
import { db, auth } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [pendingTwoFactor, setPendingTwoFactor] = useState(false);
  const [pendingTwoFactorUid, setPendingTwoFactorUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const googleProvider = new GoogleAuthProvider();

  // createUserProfile is stable via useCallback to avoid changing references
  const createUserProfile = React.useCallback(async (user, additionalData = {}) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        const { displayName, email, photoURL } = user;
        const userData = {
          displayName: displayName || additionalData.displayName || '',
          email,
          photoURL: photoURL || '',
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          twoFactorEnabled: false,
          ...additionalData
        };
        
        await setDoc(userRef, userData);
        return userData;
      }
      
      return userSnap.data();
    } catch (error) {
      logger.error('Error creating user profile:', error);
      throw error;
    }
  }, []);

  // Create user profile in Firestore

  // Sign up with email and password
  const signup = async (email, password, displayName) => {
    try {
      setError('');
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update display name
      await updateProfile(user, { displayName });
      
      // Create user profile in Firestore
      const profile = await createUserProfile(user, { displayName });
      setUserProfile(profile);
      
      return user;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Enable 2FA by saving secret to user profile (must be verified on client before calling)
  const enableTwoFactor = async (uid, secret) => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { twoFactorEnabled: true, twoFactorSecret: secret });
      // reload profile
      await loadUserProfile({ uid });
    } catch (err) {
      logger.error('Failed to enable 2FA:', err);
      throw err;
    }
  };

  const disableTwoFactor = async (uid) => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { twoFactorEnabled: false, twoFactorSecret: '' });
      await loadUserProfile({ uid });
    } catch (err) {
      logger.error('Failed to disable 2FA:', err);
      throw err;
    }
  };

  // Verify a TOTP code against stored secret (helper for login flows)
  const verifyTwoFactorCode = async (uid, token) => {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) throw new Error('User profile missing');
      const data = snap.data();
      if (!data.twoFactorEnabled) return true; // no 2FA required
      const secret = data.twoFactorSecret;
      const ok = await verifyTOTP(secret, token);
      if (ok) {
        // Clear pending 2FA state when verified successfully
        setPendingTwoFactor(false);
        setPendingTwoFactorUid(null);
        // Update lastLogin timestamp
        try {
          const userRef2 = doc(db, 'users', uid);
          await setDoc(userRef2, { lastLogin: serverTimestamp() }, { merge: true });
        } catch (e) {
          logger.error('Failed to update lastLogin after 2FA verify:', e);
        }
      } else {
        // keep pending state
      }
      return ok;
    } catch (err) {
      logger.error('2FA verification failed:', err);
      throw err;
    }
  };

  // Mark that user must complete 2FA before access is granted
  const requireTwoFactor = (uid) => {
    setPendingTwoFactor(true);
    setPendingTwoFactorUid(uid);
  };

  const clearPendingTwoFactor = () => {
    setPendingTwoFactor(false);
    setPendingTwoFactorUid(null);
  };

  // Sign in with email and password
  const login = async (email, password) => {
    try {
      setError('');
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      
      // Update last login
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
      
      return user;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Google sign in
  const signInWithGoogle = async () => {
    try {
      setError('');
      const { user } = await signInWithPopup(auth, googleProvider);
      const profile = await createUserProfile(user);
      setUserProfile(profile);
      return user;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Sign out
  const logout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Reset password
  const resetPassword = async (email) => {
    try {
      setError('');
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Load user profile
  const loadUserProfile = React.useCallback(async (user) => {
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setUserProfile(userSnap.data());
        } else {
          const profile = await createUserProfile(user);
          setUserProfile(profile);
        }
      } catch (error) {
        logger.error('Error loading user profile:', error);
      }
    } else {
      setUserProfile(null);
    }
  }, [createUserProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      await loadUserProfile(user);
      setLoading(false);
    });

    return unsubscribe;
  }, [loadUserProfile]);

  const value = {
    currentUser,
    userProfile,
    signup,
    login,
  enableTwoFactor,
  disableTwoFactor,
  verifyTwoFactorCode,
  requireTwoFactor,
  clearPendingTwoFactor,
  pendingTwoFactor,
  pendingTwoFactorUid,
    logout,
    resetPassword,
    signInWithGoogle,
    error,
    setError,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}