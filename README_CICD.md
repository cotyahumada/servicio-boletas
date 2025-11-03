# CI/CD Pipeline

## 📊 Explicación Detallada del Pipeline CI/CD

El archivo `.github/workflows/ci.yml` define todo el proceso automatizado. A continuación se explica cada parte:

### 🎯 Triggers del Pipeline

El pipeline se ejecuta automáticamente en estos casos:

```yaml
on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]
```

**Se ejecuta cuando:**
- ✅ Haces `push` a la rama `main` → Ejecuta **CI + CD** (build, test y deploy)
- ✅ Abres un **Pull Request** hacia `main`

**No se ejecuta cuando:**
- ❌ Haces push a otras ramas (solo `main`)
- ❌ Abres Pull Request hacia otras ramas

### 🔨 Job 1: `build`

**Propósito**: Validar que el código funciona correctamente antes de desplegar.

Primero se indica en que corre el servicio,
```yaml
build:
  runs-on: ubuntu-latest
```

**Pasos que ejecuta:**

1. **Checkout code** (`uses: actions/checkout@v4`)
   - Descarga todo el código del repositorio al runner de GitHub Actions

2. **Set up Node.js** (`uses: actions/setup-node@v4`)
   - Instala Node.js versión 18 en el runner
   - Configura el cache de npm para instalaciones más rápidas
   - Permite usar comandos `npm` y `node`

3. **Install dependencies** (`run: npm install`)
   - Ejecuta `npm install` para instalar todas las dependencias del proyecto
   - Instala `aws-sdk` y `pdfkit` desde `package.json`

4. **Run Build** (`run: npm run build --if-present`)
   - Ejecuta el script `build` si existe en `package.json`
   - El flag `--if-present` hace que no falle si el script no existe

5. **Run tests** (`run: npm test`)
   - Ejecuta los tests definidos en `package.json`
   - Si no hay tests, muestra un mensaje y continúa

**Resultado esperado:**
- ✅ Si todo pasa: El job continúa al siguiente paso
- ❌ Si algo falla: El pipeline se detiene y NO hace deploy

### 🤖 Job 2: `run-automation` - Scripts Automatizados

**Propósito**: Ejecutar scripts adicionales de automatización.

```yaml
run-automation:
  runs-on: ubuntu-latest
```

**Pasos que ejecuta:**

1. **Checkout code**
   - Descarga el código nuevamente (cada job tiene su propio entorno)

2. **Give automation execution permission**
   - Da permisos de ejecución al script `./scripts/tests.sh`

3. **Run automation script**
   - Ejecuta el script `./scripts/tests.sh`


### 🚀 Job 3: `deploy` - Despliegue a AWS

**Propósito**: Desplegar automáticamente el servicio a AWS Lambda.

```yaml
deploy:
  needs: build  # Espera a que build termine exitosamente
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

**Condiciones para ejecutarse:**
- ✅ El job `build` debe haber terminado exitosamente
- ✅ Solo se ejecuta si es push a la rama `main`

**Pasos que ejecuta:**

1. **Checkout code**
   - Descarga el código del repositorio
   - Asegura que tenga la versión más reciente

2. **Set up Node.js**
   - Instala Node.js 18
   - Configura cache de npm (reutiliza dependencias entre ejecuciones)

3. **Configure AWS Credentials**
   ```yaml
   uses: aws-actions/configure-aws-credentials@v4
   with:
     aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
     aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
     aws-region: sa-east-1
   ```
   - Configura las credenciales AWS usando los secrets de GitHub
   - Permite que Serverless Framework se autentique con AWS


4. **Install dependencies**
   ```bash
   run: npm install
   ```
   - Instala dependencias del proyecto (`aws-sdk`, `pdfkit`)

5. **Install Serverless Framework**
   ```bash
   run: npm install -g serverless@3
   ```
   - Instala Serverless Framework globalmente en el runner
   - Versión 3 (compatible con el `frameworkVersion: '3'` en `serverless.yml`)

6. **Deploy service**
   ```bash
   run: npx serverless deploy
   ```
   - Ejecuta `serverless deploy` que:
     - Empaqueta el código (incluye `node_modules`)
     - Crea/actualiza el stack de CloudFormation
     - Crea/actualiza la función Lambda
     - Crea/actualiza el API Gateway HTTP API
     - Crea/actualiza el rol IAM con permisos S3
     - Configura variables de entorno

**Resultado esperado:**

Al finalizar deberías ver en los logs:

```
Deploying servicio-boletas to stage dev (sa-east-1)

✔ Service deployed to stack servicio-boletas-dev (45s)

endpoints:
  POST - https://l711gbh3v3.execute-api.sa-east-1.amazonaws.com/boletas
  GET - https://l711gbh3v3.execute-api.sa-east-1.amazonaws.com/boletas/obtener

functions:
  generarBoleta: servicio-boletas-dev-generarBoleta (26 MB)
  obtenerUrl: servicio-boletas-dev-obtenerUrl (26 MB)
```


## 🔄 Flujo Completo del Pipeline

### Escenario 1: Push a `main`

```
Developer hace: git push origin main
    ↓
[GitHub detecta el push]
    ↓
[build] → Checkout → Node.js → Install deps → Build → Tests → ✓
    ↓
[deploy] → Checkout → Node.js → AWS Credentials → Install deps → Serverless → Deploy → ✓
    ↓
✅ Servicio actualizado en AWS Lambda
```

### Orden de Ejecución

Los jobs se ejecutan en este orden:

1. **`build`** se ejecuta primero (siempre)
2. **`run-automation`** se ejecuta en paralelo con `build` (independiente)
3. **`deploy`** se ejecuta después de `build` (solo si `build` pasa y es push a main)


## 📚 Referencias

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Serverless Framework Docs](https://www.serverless.com/framework/docs)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
