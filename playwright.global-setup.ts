import { execSync } from 'node:child_process'

export default async function globalSetup() {
  execSync('npm run prisma:push -w packages/server', {
    stdio: 'inherit',
  })

  execSync('npm run prisma:seed -w packages/server', {
    stdio: 'inherit',
  })
}
