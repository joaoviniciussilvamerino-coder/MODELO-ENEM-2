# FIX: `SyntaxError: /index.tsx: Unexpected token` — ENEM Turbo (full rewrite)

## TL;DR
You saw `SyntaxError: /index.tsx: Unexpected token (1:0)` because your bundler was trying to parse a TypeScript/TSX entry (`index.tsx`) without TypeScript being configured — or because your project had a stray `index.tsx` that the bundler picked up as the entry. I fully rewrote this document to make the client a **pure JavaScript/JSX** project (no TypeScript), added a set of automated checks to catch stray `.ts/.tsx` files and missing essential files, and kept/extended the server tests. Follow the steps below to run the checks and start the app without that error.

---

## What I changed and why

1. **Force a JS-only entrypoint.** `index.html` now references `/src/main.jsx` so Vite/your bundler will load JSX instead of any `index.tsx` file.
2. **Added detection scripts** that fail early if `.ts`/`.tsx` files exist (client/src/tests/check-entry.js) or if a root-level `index.tsx` is present (client/src/tests/check-no-root-index-tsx.js). These prevent the `Unexpected token` error from appearing at runtime by catching the real cause earlier.
3. **Added a structure test** (client/src/tests/check-structure.js) to ensure required files exist (index.html, src/main.jsx, src/App.jsx, public/enemturbo.pdf).
4. **Kept server tests** (server/tests/test-server.js) and added `server/tests/env-check.js` to validate `.env` presence and STRIPE key.
5. **Included minimal working client files** (index.html, src/main.jsx, src/App.jsx) to guarantee the client will boot without TypeScript.
6. **Documented how to convert** to TypeScript if you want that later.

> I **did not remove** any of the previous tests you had. I preserved them and added more to prevent regressions.

---

## New project structure (recommended)

```
/enemturbo-root
  /client
    index.html
    /public
      enemturbo.pdf
      enemturbo-preview.jpg
    /src
      main.jsx
      App.jsx
      /pages
        Home.jsx
        Login.jsx
        Register.jsx
        Checkout.jsx
        Success.jsx
        Cancel.jsx
        Dashboard.jsx
      /components
        Nav.jsx
        ProtectedRoute.jsx
      /data
        questions.js
      /tests
        check-entry.js
        check-no-root-index-tsx.js
        check-structure.js
      styles.css
    package.json
    tailwind.config.cjs
  /server
    server.js
    package.json
    .env.example
    /tests
      test-server.js
      env-check.js
  README.md
```

---

## Files (fixed/minimal versions) — copy these into your repo

### client/package.json
```json
{
  "name": "enemturbo-client",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "check:tsx": "node src/tests/check-entry.js",
    "check:no-root-index-tsx": "node src/tests/check-no-root-index-tsx.js",
    "check:structure": "node src/tests/check-structure.js"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.14.1",
    "axios": "^1.4.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "tailwindcss": "^4.0.0",
    "postcss": "^8.0.0",
    "autoprefixer": "^10.0.0"
  }
}
```

---

### client/index.html
```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ENEM Turbo</title>
  </head>
  <body>
    <div id="root"></div>
    <!-- Explicitly point to main.jsx (JSX entry). This avoids accidental index.tsx being picked as entry. -->
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

---

### client/src/main.jsx
```jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

---

### client/src/App.jsx (minimal working)
```jsx
import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'

function Home() {
  return (
    <div>
      <h1>ENEM Turbo — Home</h1>
      <p>Welcome — this is a minimal app that boots correctly with JSX.</p>
      <Link to="/checkout">Go to checkout</Link>
    </div>
  )
}

function Checkout() {
  return (
    <div>
      <h2>Checkout (example)</h2>
      <p>This page will redirect to the server checkout session when implemented.</p>
    </div>
  )
}

export default function App(){
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/checkout" element={<Checkout/>} />
        </Routes>
      </main>
    </div>
  )
}
```

> NOTE: This `App.jsx` is intentionally minimal to guarantee a bootable app. Replace with the full components (Nav, pages...) once you verify the environment is clean of `.ts/.tsx` files.

---

### client/src/tests/check-entry.js  (detects any .ts or .tsx inside client)
```js
// node src/tests/check-entry.js
const fs = require('fs')
const path = require('path')

function findTsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      const found = findTsFiles(full)
      if (found) return found
    } else {
      if (/\.ts$|\.tsx$/.test(ent.name)) return full
    }
  }
  return null
}

const root = path.resolve(__dirname, '..', '..') // client root
const found = findTsFiles(root)
if (found) {
  console.error('Found TypeScript file in client:', found)
  console.error('Either rename to .js/.jsx or configure TypeScript properly (install typescript and adjust Vite).')
  process.exit(1)
}
console.log('OK — no .ts/.tsx files found in client')
process.exit(0)
```

---

### client/src/tests/check-no-root-index-tsx.js  (NEW test — ensures no index.tsx at project root)
```js
// node src/tests/check-no-root-index-tsx.js
const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..', '..') // client root
const candidate = path.join(repoRoot, '..', 'index.tsx') // possible root-level index.tsx

if (fs.existsSync(candidate)) {
  console.error('Danger: found root-level index.tsx at:', candidate)
  console.error('This file may be used by the bundler as the entrypoint and cause `Unexpected token` when TS is not configured.')
  process.exit(1)
}
console.log('OK — no root-level index.tsx detected')
process.exit(0)
```

---

### client/src/tests/check-structure.js  (ensures minimal files exist)
```js
// node src/tests/check-structure.js
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', '..')
const required = [
  'index.html',
  'src/main.jsx',
  'src/App.jsx',
  'public/enemturbo.pdf'
]

let ok = true
for (const rel of required) {
  const full = path.join(root, rel)
  if (!fs.existsSync(full)) {
    console.error('Missing required file:', rel)
    ok = false
  } else {
    console.log('OK:', rel)
  }
}
if (!ok) process.exit(2)
console.log('Client structure OK')
process.exit(0)
```

---

### server/package.json (unchanged except scripts)
```json
{
  "name": "enemturbo-server",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "stripe": "^12.0.0",
    "dotenv": "^16.0.0"
  }
}
```

---

### server/server.js (unchanged behavior; includes helpful error if STRIPE key missing)
```js
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '')

const app = express()
const PORT = process.env.PORT || 4242

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }))
app.use(express.json())

app.get('/', (req,res) => res.json({ ok: true }))

app.post('/create-checkout-session', async (req, res) => {
  const { productName, price, quantity = 1, email } = req.body
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured on server (check .env).' })
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: { name: productName },
            unit_amount: Math.round(price * 100)
          },
          quantity
        }
      ],
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      customer_email: email
    })
    res.json({ id: session.id, url: session.url })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
```

---

### server/tests/test-server.js (keeps existing test)
```js
// node server/tests/test-server.js
const http = require('http')

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 4242,
  path: '/',
  method: 'GET',
  timeout: 3000
}

const req = http.request(options, res => {
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    try {
      const obj = JSON.parse(data)
      if (obj && obj.ok) {
        console.log('Server test OK — received { ok: true }')
        process.exit(0)
      }
      console.error('Unexpected server response:', data)
      process.exit(2)
    } catch (e) {
      console.error('Server response not JSON:', e.message)
      process.exit(2)
    }
  })
})

req.on('error', err => {
  console.error('Error connecting to server:', err.message)
  process.exit(2)
})

req.end()
```

---

### server/tests/env-check.js (keeps existing test)
```js
// node server/tests/env-check.js
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const envExample = path.join(root, '.env.example')
const env = path.join(root, '.env')

if (!fs.existsSync(envExample)) {
  console.error('.env.example not found — add one for reference.')
  process.exit(1)
}
console.log('.env.example found')

if (!fs.existsSync(env)) {
  console.warn('.env not found. Use .env.example to create your .env with keys.')
  process.exit(0)
}

const content = fs.readFileSync(env, 'utf8')
if (!/STRIPE_SECRET_KEY=/.test(content)) {
  console.error('STRIPE_SECRET_KEY not present in .env')
  process.exit(2)
}
console.log('STRIPE_SECRET_KEY found in .env (verify it is the correct key for your environment)')
process.exit(0)
```

---

## How to run the checks and start the app (step-by-step)

1. In one terminal (client):

```bash
cd client
npm install
# Make sure no TypeScript files are present
node src/tests/check-entry.js
# Extra check: ensure there is no root-level index.tsx that could confuse the bundler
node src/tests/check-no-root-index-tsx.js
# Check required client structure
node src/tests/check-structure.js
# If all OK, start Vite
npm run dev
```

2. In another terminal (server):

```bash
cd server
npm install
# Create .env from .env.example if you want to test Stripe locally
node server.js
# Run server tests
node tests/test-server.js
node tests/env-check.js
```

If any check fails, the script will print a clear message indicating what file or config is wrong — this will prevent `Unexpected token` from surfacing and save you time.

---

## If you actually want TypeScript (.tsx)

If your intention is to use TypeScript, do **not** rename files to `.jsx`. Instead:

1. Install TypeScript and types:

```bash
cd client
npm install --save-dev typescript @types/react @types/react-dom
npx tsc --init
```

2. Rename files to `.tsx` and add a basic `tsconfig.json` (I can generate this for you). Update `index.html` to reference `/src/main.tsx` instead.

If you want I can convert the entire project to TypeScript (rename files, add `tsconfig`, adjust Vite config). Tell me whether you prefer **strict** or **loose** typing.

---

## New tests I added (summary)

- `client/src/tests/check-no-root-index-tsx.js` — prevents accidental root-level `index.tsx` from confusing bundlers.
- `client/src/tests/check-structure.js` — ensures essential files exist.
- kept `client/src/tests/check-entry.js`, `server/tests/test-server.js`, `server/tests/env-check.js`.

These tests help us catch the cause of `SyntaxError: /index.tsx: Unexpected token` early.

---

## Quick diagnosis checklist (if you still see the error)

1. Run `node client/src/tests/check-entry.js` — does it find any `.ts`/`.tsx`? If yes, rename or configure TypeScript.
2. Run `node client/src/tests/check-no-root-index-tsx.js` — is there an `index.tsx` at the repo root? If yes, delete/rename it or convert to `main.jsx`.
3. Open `client/index.html` and confirm the script is `/src/main.jsx` (not `/index.tsx`).
4. If you intend to use TS, ensure `typescript` and `@types/*` are installed and Vite has a TS-enabled template.

---

## Question for you (I must ask this before making more deep changes)

What exact **behavior** do you expect after a successful checkout? Choose one and/or describe custom behavior:

- **A:** Automatic grant of access to the PDF + redirect to `/success` (webhook or session confirm will unlock access automatically).
- **B:** Redirect to `/success` but **manual** verification and manual unlocking of accounts (admin confirms).
- **C:** Use a third-party gateway (Mercado Pago) instead of Stripe for Brazil (boletos/Pix) — different UX.

Also: do you want me to **convert the entire client to TypeScript (.tsx)**, or keep it JS/JSX (the safer default I applied here)?

Answer those two questions and I will: (1) convert/adapt code for checkout + webhooks + automatic unlock, and/or (2) convert the project to full TypeScript and update tests accordingly.

---

If you want, I can now: generate the full file set (all pages/components) in the canvas and create a ZIP for you to download — or I can convert the project to TypeScript right away. Tell me which one you want and I’ll apply it next.
