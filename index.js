import concurrently from 'concurrently'

concurrently([
  {
    command: 'npm run dev -w packages/server',
    name: 'server',
    prefixColor: 'blue',
  },
  {
    command: 'npm run dev -w packages/client',
    name: 'client',
    prefixColor: 'green',
  },
])
