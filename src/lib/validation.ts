/**
 * Standardized validation utility for financial and data integrity
 */

export const validateNumericInput = (value: string | number): { isValid: boolean; error?: string; numericValue: number } => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) {
    return { isValid: false, error: 'Veuillez entrer un nombre valide.', numericValue: 0 };
  }
  
  if (num < 0) {
    return { isValid: false, error: 'Le montant ne peut pas être négatif.', numericValue: num };
  }
  
  if (num > 1000000000) {
    return { isValid: false, error: 'Le montant dépasse les limites autorisées.', numericValue: num };
  }
  
  return { isValid: true, numericValue: num };
};

export const validateStringInput = (value: string, minLength: number = 1, maxLength: number = 255): { isValid: boolean; error?: string } => {
  const trimmed = value.trim();
  
  if (trimmed.length < minLength) {
    return { isValid: false, error: `Ce champ doit contenir au moins ${minLength} caractère(s).` };
  }
  
  if (trimmed.length > maxLength) {
    return { isValid: false, error: `Ce champ ne doit pas dépasser ${maxLength} caractères.` };
  }
  
  return { isValid: true };
};
