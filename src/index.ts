import { createApp } from './utils'
import { hookRoute, testRoute } from './routes'
import { HOOK_PREFIX, TEST_PREFIX } from './consts'

const app = createApp()
	.route(HOOK_PREFIX, hookRoute)
	.route(TEST_PREFIX, testRoute)

export default app
