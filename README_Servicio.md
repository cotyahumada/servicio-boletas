# Servicio de Generación de Boletas PDF - AWS Lambda

Servicio serverless que genera boletas en formato PDF desde AWS Lambda, las almacena en S3 y entrega un enlace pre-firmado para descarga. Desplegado usando Serverless Framework.

## 📋 Tabla de Contenidos

- [Descripción del Servicio](#descripción-del-servicio)
- [Requisitos Previos](#requisitos-previos)
- [Configuración Inicial en AWS](#configuración-inicial-en-aws)
- [Instalación Local](#instalación-local)
- [Despliegue Manual (Sin CI/CD)](#despliegue-manual-sin-cicd)
- [Despliegue con CI/CD Pipeline](#Paso-a-Paso-del-Despliegue-con-CI/CD Pipeline
)

---

## 🎯 Descripción del Servicio

Este servicio expone dos endpoints HTTP:

1. **POST /boletas**: Genera una boleta PDF con la información del grupo, usuario y acción, la almacena en S3 y retorna un enlace pre-firmado válido por 10 minutos.
2. **GET /boletas/obtener**: Regenera un enlace pre-firmado para un archivo existente en S3.

### Software Necesario

- **Node.js 18.x** o superior
- **npm** (incluido con Node.js)
- **Git**
- **AWS CLI v2** (opcional para configuración local)

### Cuenta AWS

- Cuenta de AWS activa
- Permisos de administrador o IAM con los permisos necesarios

### Archivos Clave del servicio
- handler.js
Contiene la lógica de negocio:
- generarBoleta: Recibe datos, genera PDF, lo sube a S3 y retorna URL
obtenerUrl: Regenera URL para un archivo existente en S3
- serverless.yml
Configuración de infraestructura:
Provider: Configuración AWS (región, runtime, permisos)
Functions: Definición de funciones Lambda y sus endpoints
IAM Role: Permisos que tendrá la Lambda (S3)
- .github/workflows/ci.yml
Pipeline de CI/CD que:
Ejecuta tests en cada push/PR
Despliega automáticamente en push a main


# Paso a Paso para desplegar en serverless localmente

## ⚙️ Configuración Inicial

### Paso 1: Crear Usuario IAM para Despliegues

1. Ve a **IAM → Users → Create user**
2. Nombre: `servicio-boletas` (o el que prefieras)
3. Selecciona **"Access key - Programmatic access"**
4. Asigna las siguientes políticas administradas:
   - `AWSCloudFormationFullAccess`
   - `AWSLambda_FullAccess`
   - `AmazonAPIGatewayAdministrator`
   - `AmazonS3FullAccess`
   - `IAMFullAccess` (o permisos limitados para crear roles)
5. **Guarda las credenciales** (Access Key ID y Secret Access Key) en un lugar seguro

### Paso 2: Crear Bucket S3

1. Ve a **S3 → Create bucket**
2. Configuración:
   - **Bucket name**: `bucket-servicio-boletas-arquisisg15` (o el nombre que prefieras)
   - **AWS Region**: `sa-east-1` (Sao Paulo) - **Debe coincidir con la región de Lambda**
   - **Object Ownership**: ACLs disabled (recomendado)
   - **Block Public Access**: **ACTIVADO** (no hacer público)
   - **Default encryption**: Activado (SSE-S3)
3. Click en **Create bucket**

### Paso 3: Configurar AWS CLI

Si quieres usar AWS CLI para verificar:

```bash
# Instalar AWS CLI (macOS con Homebrew)
brew install awscli

# Configurar credenciales
aws configure --profile servicio-boletas

# Ingresar:
# - AWS Access Key ID: [tu access key]
# - AWS Secret Access Key: [tu secret key]
# - Default region name: sa-east-1
# - Default output format: json

# Verificar configuración
aws sts get-caller-identity --profile servicio-boletas
```

### Paso 4: Verificar Dependencias


```
# Instalar dependencias del proyecto
npm install

# Instalar Serverless Framework globalmente 
npm install -g serverless@3

# Verificar instalación
serverless --version
```

## Configuración Serverless

### Paso 5: Verificar documento serverless.yml

Revisa que `serverless.yml` tenga:
- Región correcta: `sa-east-1`
- Nombre del bucket correcto: `bucket-servicio-boletas-arquisisg15`
- Runtime correcto: `nodejs18.x`

## Despliegue

### Paso 6: Desplegar a AWS

```bash
# Desplegar usando perfil local
npx serverless deploy --aws-profile servicio-boletas

```

### Paso 7: Verificar Despliegue
Al final del comando anterior se espera una respuesta así:

```
✔ Service deployed to stack servicio-boletas-dev (XXs)

endpoints:
  POST - https://xxxxx.execute-api.sa-east-1.amazonaws.com/boletas
  GET - https://xxxxx.execute-api.sa-east-1.amazonaws.com/boletas/obtener
```

### Paso 8: Probar el Servicio

En postman hacer un POST a https://xxxxx.execute-api.sa-east-1.amazonaws.com/boletas
En el body tiene que ir el siguiente json,
```
{
    "grupo": "15",
    "usuario": {
      "nombre": "Usuario Prueba",
      "email": "usuario@gmail.com"
    },
    "accion": {
      "nombre": "propiedad 1",
      "precio": 100,
      "pagado": 10
    }
  }
```

Y la respuesta esperada es,
```
{
  "message": "Boleta generada",
  "urlDescarga": "https://bucket-servicio-boletas-arquisisg15.s3.sa-east-1.amazonaws.com/boletas/15/coty@gmail.com-1704123456789.pdf?X-Amz-Algorithm=...",
  "bucket": "bucket-servicio-boletas-arquisisg15",
  "key": "boletas/15/coty@gmail.com-1704123456789.pdf"
}
```

# Paso a Paso del Despliegue con CI/CD Pipeline

## Configuración 

### Paso 1: Configurar pipeline
En el archivo ci.yml dentro de .github/workflows se encuentra la configuración del pipeline CI/CD el cual se explica más abajo

### Paso 2: Configurar Secrets en Github
En los secrets de github actions es necesario guardar todas las variables de entorno
```
AWS_ACCESS_KEY_ID=Access Key ID del usuario IAM |
AWS_SECRET_ACCESS_KEY=Secret Access Key del usuario IAM |
```

## Despliegue

### Paso 3: Hacer push o pull request en main
```
git add .
git commit -m "Actualizar servicio"
git push origin main
```
Luego de hacer esto 
Job build: Debe pasar (✓)
Job deploy: Debe pasar (✓)

El job deploy debe mostrar en los logs lo siguiente:
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


