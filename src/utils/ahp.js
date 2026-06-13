// src/utils/ahp.js

// Random Index (RI) Saaty
const RI_TABLE = {
  1: 0,
  2: 0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49,
};

// Buat matriks awal (identitas)
export const createInitialMatrix = (n) => {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 1;
      if (i < j) return 0;
      return 0;
    })
  );
};

// Update nilai matriks + reciprocal otomatis
export const updateMatrixValue = (matrix, row, col, value) => {
  const newMatrix = matrix.map((r) => [...r]);
  newMatrix[row][col] = value;

  if (value !== 0) {
    newMatrix[col][row] = parseFloat((1 / value).toFixed(4));
  }

  return newMatrix;
};

// Hitung AHP
export const calculateAHP = (matrix) => {
  const n = matrix.length;

  // Jumlah kolom
  const colSums = Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      colSums[j] += matrix[i][j];
    }
  }

  // Normalisasi + bobot
  const weights = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let rowSum = 0;
    for (let j = 0; j < n; j++) {
      rowSum += matrix[i][j] / colSums[j];
    }
    weights[i] = rowSum / n;
  }

  // Lambda Max
  let lambdaMax = 0;
  for (let j = 0; j < n; j++) {
    lambdaMax += colSums[j] * weights[j];
  }

  const CI = (lambdaMax - n) / (n - 1);
  const CR = CI / (RI_TABLE[n] || 1);

  return {
    weights,
    lambdaMax,
    CI,
    CR,
    isConsistent: CR < 0.1,
  };
};
