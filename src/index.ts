import { Hono } from "hono"
import { logger } from "hono/logger"
import { HTTPException } from "hono/http-exception"
import { Bindings } from "./bindings"
import { HOOK_PREFIX, TEST_PREFIX } from "./constants"
import hook from "./routes/hook"
import test from "./routes/test"

const app = new Hono<{ Bindings: Bindings }>()

app.use("*", logger())
app.get("/", (c) => c.text("Hello B-Komachi-AI!"))
app.onError((err, c) => {
    if (err instanceof HTTPException) {
        return err.getResponse()
    }
    return c.text(err.message, 500)
})

app.route(HOOK_PREFIX, hook)
app.route(TEST_PREFIX, test)

export default app
