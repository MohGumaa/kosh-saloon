export const env = {
  env: process.env.NODE_ENV,
  appName: process.env.APP_NAME,
  appNameAR: process.env.APP_NAMEAR,
  databaseUrl: process.env.DATABASE_URL!,
  currentYear: new Date().getFullYear(),
}