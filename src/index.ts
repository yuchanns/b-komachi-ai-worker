import { Hono } from "hono/tiny"
import { Bindings } from "./bindings"
import { HOOK_PREFIX, TEST_PREFIX } from "./constants"
import hook from "./routes/hook"
import test from "./routes/test"

const app = new Hono<{ Bindings: Bindings }>()

app.get("/", (c) => c.text("Hello B-Komachi-AI!"))
app.onError((err, c) => {
    return c.text(err.message, 500)
})

app.route(HOOK_PREFIX, hook)
app.route(TEST_PREFIX, test)

export default app
