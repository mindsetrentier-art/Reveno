/// <reference types="vite/client" />
import CryptoJS from 'crypto-js';

const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'reveno-intelligence-fallback-key-2024';

/**
 * Encrypts a string value using AES.
 */
export function encryptValue(value: string): string {
  return CryptoJS.AES.encrypt(value, SECRET_KEY).toString();
}

/**
 * Decrypts an AES encrypted string.
 */
export function decryptValue(ciphertext: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}

/**
 * Encrypts an object by converting it to JSON string first.
 */
export function encryptData(data: any): string {
  return encryptValue(JSON.stringify(data));
}

/**
 * Decrypts a string back into an object.
 */
export function decryptData<T>(ciphertext: string): T | null {
  const decrypted = decryptValue(ciphertext);
  if (!decrypted) return null;
  try {
    return JSON.parse(decrypted) as T;
  } catch (error) {
    console.error('Failed to parse decrypted data:', error);
    return null;
  }
}

/**
 * Encrypts a number by converting to string.
 */
export function encryptNumeric(value: number): string {
  return encryptValue(value.toString());
}

/**
 * Decrypts a ciphertext back into a number.
 */
export function decryptNumeric(ciphertext: string): number {
  const decrypted = decryptValue(ciphertext);
  const num = parseFloat(decrypted);
  return isNaN(num) ? 0 : num;
}
