import { execSync } from 'node:child_process'

export default async function globalSetup() {
  if (process.env.NODE_ENV === 'production' || process.env.E2E_DATABASE_RESET !== 'true') {
    throw new Error(
      'E2E tests require E2E_DATABASE_RESET=true and a disposable DATABASE_URL. Never use your personal or production database.',
    )
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Set DATABASE_URL to a disposable PostgreSQL test database before running E2E tests.',
    )
  }

  execSync('npm exec -w packages/server -- prisma migrate reset --force', {
    stdio: 'inherit',
    env: { ...process.env, DIRECT_URL: process.env.DATABASE_URL },
  })

  execSync('npm run prisma:seed -w packages/server', {
    stdio: 'inherit',
  })
}
