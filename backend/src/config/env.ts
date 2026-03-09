import dotenv from "dotenv";

dotenv.config();

function getRequiredEnv(name:string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing required env var: ${name}`);
  return v;   
}

function getNumberEnv(name: string, fallback?: number): number {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    if(fallback !== undefined){
return fallback;
    } 
    throw new Error(`Missing required env var: ${name}`);
    
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) throw new Error(`Environment variable ${name} must be a valid number`);
  return parsed;
}

export function getDbEnv() {
  return {
    host: getRequiredEnv("DB_HOST"),
    port: getNumberEnv("DB_PORT", 5432),
    user: getRequiredEnv("DB_USER"),
    password: getRequiredEnv("DB_PASSWORD"),
    database: getRequiredEnv("DB_NAME"),
  };
}

export function getAuthEnv() {
  return {
    jwtSecret: getRequiredEnv("JWT_SECRET"),
  }
}

export function getServerEnv(){
  return {
    port: getNumberEnv("PORT", 4000) ,
    db: getDbEnv(),
  }
}

