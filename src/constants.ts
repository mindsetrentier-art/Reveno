/**
 * Global Constants for Categories and Date Options
 */

export const CATEGORIES = [
  { id: 'fdj', label: 'FDJ (Française des Jeux)', color: '#2563eb' },
  { id: 'tabac', label: 'Tabac', color: '#b91c1c' },
  { id: 'prepaye', label: 'Prépayé / Moyens Paiement', color: '#9333ea' },
  { id: 'dgfip', label: 'DGFIP Paiement de proximité', color: '#6366f1' },
  { id: 'nirio', label: 'Nirio', color: '#059669' },
  { id: 'transport', label: 'Transport', color: '#15803d' },
  { id: 'fumeurs', label: 'Articles fumeurs', color: '#ea580c' },
  { id: 'bar10', label: 'Bar boisson 10%', color: '#f59e0b' },
  { id: 'bar20', label: 'Bar boisson 20%', color: '#b45309' },
  { id: 'vape', label: 'Vape', color: '#06b6d4' },
  { id: 'tabletterie', label: 'Tabletterie', color: '#14b8a6' },
  { id: 'nickel', label: 'Compte Nickel', color: '#c2410c' },
];

export const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
