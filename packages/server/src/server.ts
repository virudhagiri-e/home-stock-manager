import cors from 'cors'
import express from 'express'
import { env } from './config.js'
import { registerRoutes } from './routes.js'

const app = express()

app.use(express.json())
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}))

registerRoutes(app)

async function bootstrap() {
  try {
    app.listen(env.PORT, () => {
      console.log(`API running on http://localhost:${env.PORT}`)
    })
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

bootstrap()
