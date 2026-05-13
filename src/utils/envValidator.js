/**
 * envValidator.js - Valide les variables d'environnement critiques
 * 
 * Appelé au démarrage du serveur dans server.js
 * Termine le processus avec code 1 si une variable critique est manquante
 */

const requiredEnvVars = {
  // Database
  DATABASE_URL: "URL de connexion à la base de données MySQL",
  
  // JWT
  JWT_SECRET: "Clé secrète pour signer les JWT",
  
  // Frontend
  CLIENT_URL: "URL du frontend pour les CORS",
  
  // Environment
  NODE_ENV: "Environnement (development/production)",
};

function validateEnv() {
  const missing = [];
  
  for (const [key, description] of Object.entries(requiredEnvVars)) {
    if (!process.env[key]) {
      missing.push(`  ❌ ${key} - ${description}`);
    }
  }
  
  if (missing.length > 0) {
    console.error("\n🚨 VARIABLES D'ENVIRONNEMENT MANQUANTES:\n");
    console.error(missing.join("\n"));
    console.error("\n📝 Vérifiez votre fichier .env\n");
    process.exit(1);
  }
  
  console.log("✅ Variables d'environnement validées avec succès");
}

module.exports = { validateEnv, requiredEnvVars };
