# Edge TTS WebSocket 客户端限制说明

## 问题

Cloudflare Workers **不支持**使用标准 WebSocket API 创建**出站** WebSocket 客户端连接到外部服务器（如 Microsoft Edge TTS）。

错误信息：
```
TypeError: Fetch API cannot load: wss://api.msedgeservices.com/...
```

## 原因

Cloudflare Workers 的 `fetch()` API 和 WebSocket 支持仅用于：
- **入站** WebSocket 连接（作为服务器接受客户端连接）
- **HTTP/HTTPS** 出站请求

不支持：
- **出站** WebSocket 客户端连接到外部服务器

## 可能的解决方案

### 方案 1：使用 Cloudflare TCP Sockets（推荐）
如果您有 Workers Paid 计划，可以使用 `connect()` API 创建 TCP socket 连接：

```typescript
// 需要在 wrangler.toml 中添加
// [sockets]
// outbound = "allow"

const socket = connect("api.msedgeservices.com:443", {
  secureTransport: "on",
  allowHalfOpen: false,
});
```

参考：https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/

### 方案 2：使用代理服务
创建一个中间代理服务（运行在支持 WebSocket 客户端的环境，如 Node.js）：
- Cloudflare Worker → HTTP → 代理服务器
- 代理服务器 → WebSocket → Microsoft Edge TTS

### 方案 3：使用替代 TTS 服务
考虑使用基于 HTTP API 的 TTS 服务：
- Google Cloud Text-to-Speech
- Amazon Polly
- Azure Cognitive Services Speech（HTTP REST API）
- ElevenLabs

### 方案 4：在部署前预生成音频
如果词汇量有限，可以预先生成音频文件并存储在 R2 或其他存储服务中。

## 当前代码状态

代码已正确更新为使用新的 Microsoft Edge TTS API：
- ✅ URL: `api.msedgeservices.com/tts/cognitiveservices`
- ✅ 认证: `Ocp-Apim-Subscription-Key`
- ✅ Sec-MS-GEC token 生成
- ✅ 所有必需的 WebSocket 头部

问题不在代码实现，而在于 Cloudflare Workers 平台的限制。

## 验证当前部署

如果日志显示请求到旧地址 `speech.platform.bing.com`，请：

1. 确认最新代码已部署：
   ```bash
   pnpm run deploy
   ```

2. 检查部署的代码：
   ```bash
   wrangler tail
   ```

3. 清除所有缓存

4. 验证环境变量和配置正确
