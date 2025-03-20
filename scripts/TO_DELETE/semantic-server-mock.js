/**
 * Semantic Server Mock
 * Simple placeholder until imports are fixed
 */

console.log('Starting mock semantic analysis server');
console.log('This is a placeholder implementation');

// Mock server functionality
const mockEmbed = (text) => {
  console.log(`Would generate embedding for: ${text.substring(0, 50)}...`);
  return new Array(384).fill(0.1);
};

const mockSimilarity = (vec1, vec2) => {
  console.log('Would calculate similarity between vectors');
  return 0.85;
};

console.log('Mock semantic server ready!');

// Keep process alive
setInterval(() => {}, 1000);
