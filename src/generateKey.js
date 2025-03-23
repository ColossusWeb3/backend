const crypto = require('crypto');

function generateEd25519KeyPair() {
  // Generate a new key pair
  const keyPair = crypto.generateKeyPairSync('ed25519');
  
  // Export the keys in the format needed for Farcaster
  const privateKey = keyPair.privateKey.export({
    type: 'pkcs8',
    format: 'der'
  });
  
  const publicKey = keyPair.publicKey.export({
    type: 'spki',
    format: 'der'
  });
  
  // Convert to hex strings
  const privateKeyHex = Buffer.from(privateKey).toString('hex');
  const publicKeyHex = Buffer.from(publicKey).toString('hex');
  
  return {
    privateKeyHex,
    publicKeyHex
  };
}

// Generate and display the keys
const keys = generateEd25519KeyPair();
console.log('Private Key (hex):', keys.privateKeyHex);
console.log('Public Key (hex):', keys.publicKeyHex);